/**
 * 自動保存インジケーター
 * 
 * 自動保存の有効/無効状態と保存ステータスを表示
 */

import React from 'react';

interface AutoSaveIndicatorProps {
  enabled: boolean;
  saveStatus?: 'idle' | 'saving' | 'saved' | 'error';
  lastSaved?: Date | null;
}

export const AutoSaveIndicator: React.FC<AutoSaveIndicatorProps> = ({ 
  enabled, 
  saveStatus = 'idle',
  lastSaved 
}) => {
  if (!enabled) {
    return (
      <div className="flex items-center gap-2 px-2 py-1 bg-gray-100 rounded-md">
        <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
        <span className="text-xs text-gray-600">自動保存: 無効</span>
      </div>
    );
  }

  const getStatusInfo = () => {
    switch (saveStatus) {
      case 'saving':
        return {
          color: 'text-blue-600',
          bgColor: 'bg-blue-100',
          dotColor: 'bg-blue-500',
          text: '保存中...',
          icon: (
            <div className="animate-spin rounded-full h-3 w-3 border border-blue-500 border-t-transparent"></div>
          )
        };
      case 'saved':
        return {
          color: 'text-green-600',
          bgColor: 'bg-green-100',
          dotColor: 'bg-green-500',
          text: '保存済み',
          icon: (
            <svg className="w-3 h-3 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          )
        };
      case 'error':
        return {
          color: 'text-red-600',
          bgColor: 'bg-red-100',
          dotColor: 'bg-red-500',
          text: 'エラー',
          icon: (
            <svg className="w-3 h-3 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          )
        };
      default:
        return {
          color: 'text-green-600',
          bgColor: 'bg-green-100',
          dotColor: 'bg-green-500',
          text: '待機中',
          icon: (
            <div className={`w-2 h-2 bg-green-500 rounded-full`}></div>
          )
        };
    }
  };

  const statusInfo = getStatusInfo();

  return (
    <div className={`flex items-center gap-2 px-2 py-1 ${statusInfo.bgColor} rounded-md`}>
      {statusInfo.icon}
      <span className={`text-xs ${statusInfo.color}`}>
        自動保存: {statusInfo.text}
      </span>
      {lastSaved && saveStatus === 'saved' && (
        <span className="text-xs text-gray-500 ml-1">
          ({lastSaved.toLocaleTimeString()})
        </span>
      )}
    </div>
  );
};