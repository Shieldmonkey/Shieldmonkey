# Shieldmonkey

Shieldmonkeyは、セキュリティと監査可能性を最優先に設計されたManifest V3準拠のユーザースクリプトマネージャーです。

## 設計と特徴

### 強固なセキュリティポリシー (CSP)
Shieldmonkeyは、拡張機能自身が外部と意図しない通信を行うことを防ぐため、厳格なContent Security Policy (CSP) を設定しています。
Background Scriptや各ページからの外部接続は遮断されます。これに伴い、以下の機能は意図的に排除されています。

- `GM_xmlHttpRequest` などのCORSを回避する関数
- `require` による外部スクリプトの動的読み込み
- クラウドサービスへの自動バックアップ
- スクリプトの自動更新

全ての更新はユーザーの手動操作によってのみ行われ、バックグラウンドでの意図しないコードの書き換えや実行を防ぎます。

### サプライチェーンの安全性
開発およびビルドプロセスにおいてNPMのベストプラクティスを採用し、サプライチェーン攻撃への耐性を高めています。

- `npm ci` の使用による、lockファイルに基づいた厳密なバージョン管理
- `postinstall` などの自動実行スクリプトの禁止

### 監査可能なビルド
透明性を確保するため、以下のビルド方針を採用しています。

- ビルドされた拡張機能のソースコードは、監査のしやすさを優先し、意図的にMinify（圧縮・難読化）を行っていません。
- デバッグと検証のためにSourceMapを同梱しています。
- 配布サイズを考慮したMinify版も提供されますが、非Minify版の利用を推奨します。

利用者が自らの手でソースコードからビルドし、その中身が検証可能であることを最も重視しています。各ストアからのインストールも可能ですが、GitHub上のソースコードからビルドしたものの利用を第一に推奨します。

## 機能

- スクリプトの管理（インストール、編集、削除、無効化）
- Monaco Editorによる編集環境（TypeScript/JavaScriptサポート）
- `.user.js` 形式への対応
- ローカルへのインポート・エクスポート

## 技術スタック

- React 19
- Vite (w/ CRXJS)
- TypeScript
- Monaco Editor
- IndexedDB
- Vanilla CSS / Sass

## インストールとビルド

1. リポジトリのクローン
   ```bash
   git clone https://github.com/shieldmonkey/shieldmonkey.git
   cd shieldmonkey
   ```

2. 依存関係のインストール
   セキュリティのため `npm ci` を使用し、スクリプトの自動実行を無効化します。
   ```bash
   npm ci --ignore-scripts
   ```

3. ビルド
   ```bash
   npm run build
   ```

4. 拡張機能の読み込み
   Chromeの `chrome://extensions` を開き、デベロッパーモードを有効にして、生成された `dist` ディレクトリを読み込んでください。
