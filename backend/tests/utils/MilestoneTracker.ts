/**
 * マイルストーントラッカー - ★9統合テスト成功請負人が活用する処理時間計測ユーティリティ
 * 
 * 統合テストの各ステップの実行時間を計測し、パフォーマンス問題の特定を支援
 * ★9が統合テストをデバッグする際の重要な情報を提供
 */

/**
 * マイルストーン情報
 */
interface Milestone {
  name: string;
  timestamp: number;
  duration?: number;
  metadata?: Record<string, any>;
}

/**
 * パフォーマンス分析結果
 */
interface PerformanceAnalysis {
  totalDuration: number;
  slowestStep: { name: string; duration: number } | null;
  fastestStep: { name: string; duration: number } | null;
  averageDuration: number;
  stepCount: number;
  bottlenecks: Array<{ name: string; duration: number; threshold: number }>;
}

/**
 * マイルストーントラッカークラス
 */
export class MilestoneTracker {
  private milestones: Map<string, Milestone> = new Map();
  private startTime: number = Date.now();
  private currentOp: string = "初期化";
  private performanceThresholds: Map<string, number> = new Map();

  /**
   * パフォーマンス閾値の設定
   */
  constructor(private testName: string = "統合テスト") {
    this.setDefaultThresholds();
    console.log(`[${this.getElapsed()}] 🚀 開始: ${this.testName}`);
  }

  /**
   * デフォルトのパフォーマンス閾値を設定
   */
  private setDefaultThresholds(): void {
    this.performanceThresholds.set('テスト開始', 100);
    this.performanceThresholds.set('データ準備', 500);
    this.performanceThresholds.set('API呼び出し', 2000);
    this.performanceThresholds.set('DB操作', 1000);
    this.performanceThresholds.set('認証処理', 1500);
    this.performanceThresholds.set('レスポンス検証', 200);
    this.performanceThresholds.set('クリーンアップ', 300);
  }

  /**
   * カスタムパフォーマンス閾値の設定
   */
  setThreshold(operationName: string, thresholdMs: number): void {
    this.performanceThresholds.set(operationName, thresholdMs);
  }

  /**
   * 現在の操作を設定
   */
  setOperation(op: string, metadata?: Record<string, any>): void {
    this.currentOp = op;
    const milestone: Milestone = {
      name: op,
      timestamp: Date.now(),
      ...(metadata && { metadata }),
    };
    
    this.milestones.set(op, milestone);
    console.log(`[${this.getElapsed()}] ▶️ 開始: ${op}`);
    
    if (metadata) {
      console.log(`   📊 メタデータ:`, metadata);
    }
  }

  /**
   * マイルストーンの記録
   */
  mark(name: string, metadata?: Record<string, any>): void {
    const now = Date.now();
    const previousMilestone = this.milestones.get(this.currentOp);
    
    let duration: number | undefined;
    if (previousMilestone) {
      duration = now - previousMilestone.timestamp;
      previousMilestone.duration = duration;
    }

    const milestone: Milestone = {
      name,
      timestamp: now,
      ...(metadata && { metadata }),
    };
    
    this.milestones.set(name, milestone);
    
    // パフォーマンス警告のチェック
    const threshold = this.performanceThresholds.get(name) || 
                     this.performanceThresholds.get(this.currentOp);
    
    let statusIcon = '🏁';
    if (duration && threshold && duration > threshold) {
      statusIcon = '⚠️';
      console.log(`[${this.getElapsed()}] ${statusIcon} ${name} (${duration}ms - 閾値超過: ${threshold}ms)`);
    } else if (duration) {
      console.log(`[${this.getElapsed()}] ${statusIcon} ${name} (${duration}ms)`);
    } else {
      console.log(`[${this.getElapsed()}] ${statusIcon} ${name}`);
    }
    
    if (metadata) {
      console.log(`   📊 メタデータ:`, metadata);
    }
  }

  /**
   * エラー発生時の記録
   */
  markError(name: string, error: Error, metadata?: Record<string, any>): void {
    const now = Date.now();
    const previousMilestone = this.milestones.get(this.currentOp);
    
    let duration: number | undefined;
    if (previousMilestone) {
      duration = now - previousMilestone.timestamp;
      previousMilestone.duration = duration;
    }

    const errorMilestone: Milestone = {
      name: `❌ ${name}`,
      timestamp: now,
      metadata: {
        ...metadata,
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
      },
    };
    
    this.milestones.set(`error_${name}`, errorMilestone);
    
    if (duration) {
      console.log(`[${this.getElapsed()}] ❌ エラー: ${name} (${duration}ms)`);
    } else {
      console.log(`[${this.getElapsed()}] ❌ エラー: ${name}`);
    }
    
    console.log(`   💥 エラー詳細: ${error.message}`);
    
    if (metadata) {
      console.log(`   📊 メタデータ:`, metadata);
    }
  }

  /**
   * パフォーマンス分析の実行
   */
  analyze(): PerformanceAnalysis {
    const milestonesWithDuration = Array.from(this.milestones.values())
      .filter(m => m.duration !== undefined);
    
    if (milestonesWithDuration.length === 0) {
      return {
        totalDuration: this.getTotalElapsed(),
        slowestStep: null,
        fastestStep: null,
        averageDuration: 0,
        stepCount: 0,
        bottlenecks: [],
      };
    }

    const durations = milestonesWithDuration.map(m => m.duration!);
    const totalDuration = this.getTotalElapsed();
    const averageDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    
    const sortedByDuration = milestonesWithDuration.sort((a, b) => b.duration! - a.duration!);
    const slowestStep = sortedByDuration[0] && sortedByDuration[0].duration !== undefined ? {
      name: sortedByDuration[0].name,
      duration: sortedByDuration[0].duration,
    } : null;
    
    const lastMilestone = sortedByDuration[sortedByDuration.length - 1];
    const fastestStep = lastMilestone && lastMilestone.duration !== undefined ? {
      name: lastMilestone.name,
      duration: lastMilestone.duration,
    } : null;

    // ボトルネックの検出
    const bottlenecks: Array<{ name: string; duration: number; threshold: number }> = [];
    for (const milestone of milestonesWithDuration) {
      const threshold = this.performanceThresholds.get(milestone.name);
      if (threshold && milestone.duration! > threshold) {
        bottlenecks.push({
          name: milestone.name,
          duration: milestone.duration!,
          threshold,
        });
      }
    }

    return {
      totalDuration,
      slowestStep,
      fastestStep,
      averageDuration,
      stepCount: milestonesWithDuration.length,
      bottlenecks,
    };
  }

  /**
   * 結果サマリーの表示（★9のデバッグで重要）
   */
  summary(): void {
    console.log("\n" + "=".repeat(60));
    console.log(`📊 ${this.testName} - 処理時間分析レポート`);
    console.log("=".repeat(60));

    const analysis = this.analyze();
    
    // 基本統計
    console.log(`\n📈 基本統計:`);
    console.log(`   総実行時間: ${(analysis.totalDuration / 1000).toFixed(2)}秒`);
    console.log(`   ステップ数: ${analysis.stepCount}`);
    console.log(`   平均実行時間: ${analysis.averageDuration.toFixed(2)}ms`);

    // 最遅・最速ステップ
    if (analysis.slowestStep) {
      console.log(`   最遅ステップ: ${analysis.slowestStep.name} (${analysis.slowestStep.duration}ms)`);
    }
    if (analysis.fastestStep) {
      console.log(`   最速ステップ: ${analysis.fastestStep.name} (${analysis.fastestStep.duration}ms)`);
    }

    // ステップごとの詳細
    console.log(`\n⏱️  ステップ詳細:`);
    const entries = Array.from(this.milestones.entries()).filter(([, m]) => m.duration !== undefined);
    
    for (const [name, milestone] of entries) {
      const duration = milestone.duration!;
      const percentage = (duration / analysis.totalDuration * 100).toFixed(1);
      const threshold = this.performanceThresholds.get(name);
      const status = threshold && duration > threshold ? '⚠️' : '✅';
      
      console.log(`   ${status} ${name}: ${duration}ms (${percentage}%)`);
      
      if (threshold && duration > threshold) {
        console.log(`     └─ 閾値超過: ${threshold}ms を ${duration - threshold}ms 超過`);
      }
    }

    // ボトルネック警告
    if (analysis.bottlenecks.length > 0) {
      console.log(`\n⚠️  パフォーマンス警告:`);
      for (const bottleneck of analysis.bottlenecks) {
        const overageMs = bottleneck.duration - bottleneck.threshold;
        const overagePercent = ((overageMs / bottleneck.threshold) * 100).toFixed(1);
        console.log(`   🐌 ${bottleneck.name}: ${overageMs}ms 超過 (+${overagePercent}%)`);
        
        // 改善提案
        console.log(`     💡 改善提案: ${this.getOptimizationSuggestion(bottleneck.name)}`);
      }
    } else {
      console.log(`\n✅ パフォーマンス: すべてのステップが閾値内で完了`);
    }

    // リソース使用状況（簡易版）
    console.log(`\n💾 リソース使用状況:`);
    console.log(`   プロセスメモリ: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)}MB`);
    console.log(`   ステップ数/秒: ${(analysis.stepCount / (analysis.totalDuration / 1000)).toFixed(2)}`);

    console.log("\n" + "=".repeat(60) + "\n");
  }

  /**
   * 最適化提案の取得
   */
  private getOptimizationSuggestion(stepName: string): string {
    const suggestions: Record<string, string> = {
      'API呼び出し': 'リクエストの並列化、キャッシュの活用、タイムアウトの調整を検討',
      'DB操作': 'インデックスの最適化、クエリの見直し、コネクションプールの調整を検討',
      '認証処理': 'トークン検証の最適化、キャッシュの活用を検討',
      'データ準備': 'テストデータの事前生成、ファクトリーパターンの活用を検討',
      'レスポンス検証': 'アサーションの簡素化、並列検証の検討',
      'クリーンアップ': 'バッチ削除、トランザクションの活用を検討',
    };

    return suggestions[stepName] || 'ステップの処理内容を見直し、最適化を検討してください';
  }

  /**
   * 経過時間の取得
   */
  private getElapsed(): string {
    return `${((Date.now() - this.startTime) / 1000).toFixed(2)}秒`;
  }

  /**
   * 総実行時間の取得
   */
  public getTotalElapsed(): number {
    return Date.now() - this.startTime;
  }

  /**
   * JSON形式でのデータエクスポート（★9の詳細分析用）
   */
  exportData(): {
    testName: string;
    startTime: number;
    totalDuration: number;
    milestones: Milestone[];
    analysis: PerformanceAnalysis;
  } {
    return {
      testName: this.testName,
      startTime: this.startTime,
      totalDuration: this.getTotalElapsed(),
      milestones: Array.from(this.milestones.values()),
      analysis: this.analyze(),
    };
  }

  /**
   * 比較用のベンチマークデータ保存
   */
  saveBenchmark(filePath?: string): void {
    const data = this.exportData();
    const fileName = filePath || `benchmark_${this.testName.replace(/\s+/g, '_')}_${Date.now()}.json`;
    
    try {
      require('fs').writeFileSync(fileName, JSON.stringify(data, null, 2));
      console.log(`📁 ベンチマークデータを保存しました: ${fileName}`);
    } catch (error) {
      console.error(`❌ ベンチマークデータの保存に失敗しました:`, error);
    }
  }
}