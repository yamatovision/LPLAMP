#!/usr/bin/env node
/**
 * レプリカ作成の単体テスト
 * Usage: npx tsx test-replica.ts [URL]
 */

import { WebsiteReplicator } from './src/common/utils/website-replicator';
import { logger } from './src/common/utils/logger';

async function testReplication() {
  const url = process.argv[2] || 'https://airdesign.ai/';
  
  console.log('🚀 レプリカ作成テスト開始');
  console.log(`📍 対象URL: ${url}`);
  console.log('=' * 60);
  
  try {
    const replicator = new WebsiteReplicator(url, 'test-output');
    const result = await replicator.replicate();
    
    if (result.success) {
      console.log('\n✅ レプリカ作成成功！');
      console.log(`📁 出力ディレクトリ: ${result.outputDir}`);
      console.log(`📄 HTML文字数: ${result.html.length}`);
      console.log(`🎨 CSS文字数: ${result.css.length}`);
      
      // HTMLの一部を表示
      console.log('\n📄 HTML プレビュー (最初の200文字):');
      console.log('-'.repeat(50));
      console.log(result.html.substring(0, 200) + '...');
      
      // CSSの一部を表示
      console.log('\n🎨 CSS プレビュー (最初の200文字):');
      console.log('-'.repeat(50));
      console.log(result.css.substring(0, 200) + '...');
      
    } else {
      console.log('\n❌ レプリカ作成失敗');
      console.log(`エラー: ${result.error}`);
      process.exit(1);
    }
    
  } catch (error) {
    console.error('\n💥 予期しないエラー:', error);
    process.exit(1);
  }
}

// メイン実行
testReplication();