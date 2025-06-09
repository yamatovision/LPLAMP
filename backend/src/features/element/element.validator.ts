import { body } from 'express-validator';

// ValidationChain型を定義
type ValidationChain = ReturnType<typeof body>;

export const elementValidators = {
  createContext: (): ValidationChain[] => [
    body('projectId')
      .isUUID()
      .withMessage('プロジェクトIDは有効なUUID形式である必要があります'),
    
    body('element')
      .isObject()
      .withMessage('要素情報はオブジェクトである必要があります'),
    
    body('element.selector')
      .isString()
      .notEmpty()
      .withMessage('セレクタは必須です')
      .isLength({ max: 500 })
      .withMessage('セレクタは500文字以内である必要があります'),
    
    body('element.tagName')
      .isString()
      .notEmpty()
      .withMessage('タグ名は必須です')
      .matches(/^[a-zA-Z][a-zA-Z0-9-]*$/)
      .withMessage('タグ名は有効なHTML要素名である必要があります'),
    
    body('element.text')
      .optional()
      .isString()
      .withMessage('テキストは文字列である必要があります')
      .isLength({ max: 10000 })
      .withMessage('テキストは10000文字以内である必要があります'),
    
    body('element.html')
      .optional()
      .isString()
      .withMessage('HTMLは文字列である必要があります')
      .isLength({ max: 50000 })
      .withMessage('HTMLは50000文字以内である必要があります'),
    
    body('element.styles')
      .optional()
      .isObject()
      .withMessage('スタイル情報はオブジェクトである必要があります'),
    
    body('element.styles.color')
      .optional()
      .isString()
      .withMessage('色情報は文字列である必要があります'),
    
    body('element.styles.backgroundColor')
      .optional()
      .isString()
      .withMessage('背景色情報は文字列である必要があります'),
    
    body('element.styles.fontSize')
      .optional()
      .isString()
      .withMessage('フォントサイズ情報は文字列である必要があります'),
    
    body('element.styles.fontFamily')
      .optional()
      .isString()
      .withMessage('フォントファミリー情報は文字列である必要があります'),
  ],
};