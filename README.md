# 🛡️ Shieldmonkey

**Shieldmonkey** は、モダンな Web のためにゼロから設計された、次世代のユーザースクリプトマネージャーです。

Chrome Extension の **Manifest V3** に完全準拠し、セキュリティ、パフォーマンス、そして最高の開発者体験（DX）を提供することを目指しています。

---

## 💡 設計思想と特徴：なぜ Shieldmonkey なのか？

既存のユーザースクリプトマネージャー（Tampermonkey や Violentmonkey など）は素晴らしいツールですが、古いアーキテクチャ（Manifest V2）からの移行期にあり、歴史的な経緯による複雑さを抱えています。

Shieldmonkey は、**「最初から Manifest V3 ネイティブ」** であることを前提に設計されています。他との決定的な違いは以下の通りです。

### 1. 🚀 完全な Manifest V3 ネイティブアーキテクチャ
多くの拡張機能が V3 への対応に苦心する中、Shieldmonkey は Chrome の新しい `chrome.userScripts` API をネイティブに使用して構築されています。
これにより、ハック的な手法を使わずに、ブラウザの推奨する安全かつ効率的な方法でスクリプトを実行します。将来的な互換性とパフォーマンスが保証されています。

### 2. 🛡️ Security First（セキュリティ・ファースト）
名前の通り、**安全性** を最優先しています。
- **権限管理システム**: スクリプトごとに必要な権限（`GM_*` APIの使用など）を細かく制御。
- **セキュアな実行環境**: ページスクリプトとは隔離された環境で実行され、悪意のあるサイトからの干渉を防ぎます。

### 3. 💻 圧倒的な開発者体験 (Developer Experience)
「ユーザースクリプトを書く環境」にも妥協しません。
- **Monaco Editor 搭載**: VS Code と同じコアを使用する Monaco Editor を内蔵。
- **IntelliSense 対応**: コード補完、シンタックスハイライト、エラー検知がブラウザ内で利用可能。
- 貧弱なテキストエリアでのコーディングはもう終わりです。

### 4. 🎨 モダンで美しい UI
React + Vite + Modern CSS (Sass) で構築された、高速で洗練されたユーザーインターフェース。
ダークモードを標準サポートし、設定画面やポップアップも直感的で快適に操作できます。

---

## ✨ 主な機能

- **スクリプト管理**:
  - インストール、編集、削除、一括無効化
  - ドラッグ＆ドロップでのインストール（予定）
- **高度なエディタ**:
  - フル機能の TypeScript/JavaScript エディタ
  - キーボードショートカット対応
- **互換性**:
  - 既存の多くのユーザースクリプト形式（`.user.js`）をサポート
- **バックアップ**:
  - 重要なスクリプトのインポート/エクスポート機能

---

## 🛠️ 技術スタック

Shieldmonkey は最新の Web 技術で構築されています。

- **Framework**: React 19
- **Build Tool**: Vite (w/ CRXJS)
- **Language**: TypeScript
- **Editor**: Monaco Editor
- **Storage**: IndexedDB (idb)
- **Styling**: Modern CSS / Sass

---

## 📦 インストールと開発

現在は開発プレビュー段階です。以下の手順でローカル環境で試すことができます。

1. リポジトリをクローン
   ```bash
   git clone https://github.com/toshs/stickymonkey.git
   cd stickymonkey
   ```

2. 依存関係のインストール
   ```bash
   npm install
   ```
   ※ `npm ci --ignore-scripts` を推奨（セキュリティのため）

3. ビルド
   ```bash
   npm run build
   ```

4. Chrome に読み込む
   - Chrome の `chrome://extensions` を開く
   - 「デベロッパーモード」を ON にする
   - 「パッケージ化されていない拡張機能を読み込む」をクリック
   - `dist` フォルダを選択
