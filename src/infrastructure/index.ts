/**
 * Infrastructure Layer - 外部システムとの接続
 *
 * 【このレイヤーの役割】
 * Domain Layer で定義されたインターフェースを実装し、
 * 外部システム（ストレージ、API など）との接続を担当する。
 *
 * 【構成要素】
 *
 * 1. persistence/ - データ永続化
 *    - BundledQuizRepository: クイズデータの保存・読み込み
 *    - LocalStorageProgressRepository: 学習進捗の保存・読み込み
 *
 * 2. validation/ - データ検証
 *    - QuizValidator: インポートされた JSON の検証（Zod 使用）
 *
 * 【依存性逆転の原則（DIP）】
 * Domain Layer は具体的な実装に依存せず、インターフェースに依存する。
 * このレイヤーがそのインターフェースを実装する。
 *
 *   Domain Layer
 *       │
 *       │ defines
 *       ▼
 *   IQuizRepository (interface)
 *       ▲
 *       │ implements
 *       │
 *   BundledQuizRepository (this layer)
 *
 * これにより、テスト時にモック実装に差し替えられる。
 *
 * 【現在の実装】
 * - localStorage を使用（ブラウザ互換性のため）
 */

export * from './persistence'
export * from './validation'
