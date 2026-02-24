[![CI](https://github.com/Shieldmonkey/Shieldmonkey/actions/workflows/ci.yml/badge.svg)](https://github.com/Shieldmonkey/Shieldmonkey/actions/workflows/ci.yml)
[![Test](https://github.com/Shieldmonkey/Shieldmonkey/actions/workflows/test.yml/badge.svg)](https://github.com/Shieldmonkey/Shieldmonkey/actions/workflows/test.yml)
[![GitHub last commit](https://img.shields.io/github/last-commit/Shieldmonkey/Shieldmonkey?style=flat-square)](https://github.com/Shieldmonkey/Shieldmonkey/commits/main)
[![GitHub issues](https://img.shields.io/github/issues/Shieldmonkey/Shieldmonkey?style=flat-square&color=blue)](https://github.com/Shieldmonkey/Shieldmonkey/issues)
[![License](https://img.shields.io/github/license/Shieldmonkey/Shieldmonkey?style=flat-square&color=orange)](LICENSE)


[English README](README.md)

![Shieldmonkey](assets/header.jpeg)

# Shieldmonkey

Shieldmonkeyは、セキュリティと監査可能性を最優先に設計された、オープンソースでManifest V3準拠のユーザースクリプトマネージャーです。

## 設計と特徴

\`\`\`mermaid
flowchart TD
    subgraph Browser["Web Browser"]
        WP["Web Page (Target Site)"]
        
        subgraph Extension["Shieldmonkey Extension"]
            CS["Content Script"]
            
            subgraph Sandbox["Isolated Sandbox (CSP Enforced)"]
                VM["Script Emulator Context"]
                US["UserScripts (CodeMirror)"]
            end
            
            BG["Service Worker (Storage/Rules)"]
        end
        
        Internet["External Internet"]
    end

    WP <-->|DOM Access| CS
    CS <-->|Message Bridge| VM
    VM -->|Executes| US
    CS <-->|Storage/Config| BG

    %% Security boundaries
    US -.x|Blocked by CSP| Internet
    BG -.x|DNR / CSP Blocked| Internet

    classDef secure fill:#e6f3ff,stroke:#0066cc,stroke-width:2px;
    classDef blocked fill:#ffeeee,stroke:#cc0000,stroke-width:2px,stroke-dasharray: 5 5;
    class Sandbox secure;
    class Internet blocked;
\`\`\`

### 強固なセキュリティポリシー (CSP)
Shieldmonkeyは、拡張機能自身が外部と意図しない通信を行うことを防ぐため、厳格なContent Security Policy (CSP) を設定しています。
Background Scriptや各ページからの外部接続は遮断されます。これに伴い、以下の機能は意図的に排除されています。

- `GM_xmlHttpRequest` などのCORSを回避する関数
- `require` による外部スクリプトの動的読み込み
- クラウドサービスへの自動バックアップ
- スクリプトの自動更新

全ての更新はユーザーの手動操作によってのみ行われ、バックグラウンドでの意図しないコードの書き換えや実行を防ぎます。

### 監査可能なビルド
透明性を確保するため、以下のビルド方針を採用しています。

- ビルドされた拡張機能のソースコードは、監査のしやすさを優先し、意図的にMinify（圧縮・難読化）を行っていません。
- デバッグと検証のためにSourceMapを同梱しています。
- 配布サイズを考慮したMinify版も提供されますが、非Minify版の利用を推奨します。

監査可能性とコントロールを重視するユーザーのために、GitHubからの手動インストールを選択肢として提供しています。ブラウザストアによる審査と利便性を取るか、ソースコードからビルドされた固定バージョンの透明性を取るか、ユーザー自身が選択できます。

### サプライチェーンの安全性
pnpmの設定 (`pnpm-workspace.yaml`) と厳格なバージョン管理により、サプライチェーン攻撃への耐性を高めています。

- **厳格なバージョン固定 (package.json)**: `package.json` 内のすべての依存関係は、範囲指定（`^`や`~`）を使用せず、完全な固定バージョンで記述されています。これにより、ビルドごとの差異を排除します。
- **`pnpm-workspace.yaml` による保護**:
  - **`blockExoticSubdeps=true`**: Git URLなど、npmレジストリ以外からの依存関係のインストールをブロックし、信頼できないソースからのコード混入を防ぎます。
  - **`minimumReleaseAge=10080`**: 公開から7日以上経過したパッケージのみをインストールします。これにより、公開直後の悪意ある更新（Zero-day攻撃）やTyposquattingのリスクを軽減します。
  - **`trustPolicy=no-downgrade`**: 依存パッケージが密かに古いバージョンへダウングレードされることを防ぎます。
- **`ignore-scripts`**: `pnpm` ではデフォルトでスクリプトの自動実行が無効化されていますが、`.npmrc` にもフォールバックとして `ignore-scripts=true` を記述し、npm使用時でも悪意あるスクリプトが実行されないようにしています。
- **不変のロックファイル**: `lockfile=true` を強制し、CIでは `pnpm install --frozen-lockfile` を使用することで、再現性のあるビルドを保証します。

## 機能

- スクリプトの管理（インストール、編集、削除、無効化）
- CodeMirror 6による編集環境
- `.user.js` 形式への対応
- ローカルへのインポート・エクスポート

## 技術スタック

- React 19
- Vite (w/ CRXJS)
- TypeScript
- CodeMirror 6
- IndexedDB
- Vanilla CSS / Sass

## インストールとビルド

1. リポジトリのクローン
   ```bash
   git clone https://github.com/shieldmonkey/shieldmonkey.git
   cd shieldmonkey
   ```

2. 依存関係のインストール
   `.npmrc` により `ignore-scripts=true` が設定されているため、以下のコマンドで安全にインストールできます。
   ```bash
   pnpm install
   ```

3. ビルド
   ```bash
   pnpm run build
   ```

4. 拡張機能の読み込み
   Chromeの `chrome://extensions` を開き、デベロッパーモードを有効にして、生成された `dist` ディレクトリを読み込んでください。

## テスト

E2Eテストを実行してShieldmonkeyの機能を検証できます。

```bash
# Playwright Browsersをインストール（初回のみ）
pnpm exec playwright install chromium --with-deps

# 拡張機能をビルド
pnpm run build

# E2Eテストを実行
pnpm run test:e2e
```

テストには以下が含まれます：
- スクリプトのインストールとインポート
- オプションページでのスクリプト管理（作成、編集、削除）
- バックアップとリストア機能
- CSPポリシーの検証
- ポップアップページの動作確認
