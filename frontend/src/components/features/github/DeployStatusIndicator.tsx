/**
 * デプロイ状態インジケーター
 * 
 * デプロイメントの状態と公開URLを表示
 */

import React from 'react';
import { DeploymentStatus } from '@/types';

interface DeployStatusIndicatorProps {
  status: DeploymentStatus;
  url?: string | null;
}

export const DeployStatusIndicator: React.FC<DeployStatusIndicatorProps> = ({ 
  status, 
  url 
}) => {
  const getStatusInfo = () => {
    switch (status) {
      case DeploymentStatus.PENDING:
        return {
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-100',
          text: 'デプロイ待機',
          icon: (
            <svg className="w-3 h-3 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )
        };
      case DeploymentStatus.BUILDING:
        return {
          color: 'text-blue-600',
          bgColor: 'bg-blue-100',
          text: 'ビルド中',
          icon: (
            <div className="animate-spin rounded-full h-3 w-3 border border-blue-500 border-t-transparent"></div>
          )
        };
      case DeploymentStatus.READY:
        return {
          color: 'text-green-600',
          bgColor: 'bg-green-100',
          text: 'デプロイ済み',
          icon: (
            <svg className="w-3 h-3 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          )
        };
      case DeploymentStatus.ERROR:
        return {
          color: 'text-red-600',
          bgColor: 'bg-red-100',
          text: 'デプロイエラー',
          icon: (
            <svg className="w-3 h-3 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          )
        };
      default:
        return {
          color: 'text-gray-600',
          bgColor: 'bg-gray-100',
          text: '未デプロイ',
          icon: (
            <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
          )
        };
    }
  };

  const statusInfo = getStatusInfo();

  return (
    <div className={`flex items-center gap-2 px-2 py-1 ${statusInfo.bgColor} rounded-md`}>
      {statusInfo.icon}
      <span className={`text-xs ${statusInfo.color}`}>
        {statusInfo.text}
      </span>
      {url && status === DeploymentStatus.READY && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-1 text-xs text-blue-600 hover:text-blue-800 underline"
          title="デプロイされたサイトを開く"
        >
          <svg className="w-3 h-3 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      )}
    </div>
  );
};