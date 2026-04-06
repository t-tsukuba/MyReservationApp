# MyReservationApp — Claude Code ガイド

## プロジェクト概要

Spring Boot製の実験装置予約カレンダーアプリ。ファイルベース永続化（JSON）。
- **ローカル開発**: Mac上で `./gradlew bootRun` → `http://localhost:8080/reservation`
- **本番**: Raspberry Pi (192.168.100.102) で `start.sh` 経由で実行

## ファイルパス設定（重要）

`ReservationController.java` の `reservationsPath` / `logPath` / `usersPath` は**ローカルパス（相対パス）のままでOK**。

`start.sh` が `cd /home/hiejima/Desktop/MyReservationApp` してからJARを実行するため、Pi上でも相対パスが正しく解決される。Pi用の絶対パスに切り替える必要はない。

```java
// これで Mac もPiも両方動く
private final String reservationsPath = "src/main/resources/reservations/reservations.json";
```

## Pi へのデプロイ手順

1. **ローカルでビルド**（コントローラーはローカルパスのまま）
   ```bash
   ./gradlew bootJar --rerun-tasks
   ```

2. **JARをPiに転送**（Terminal.appから実行、パスワード入力あり）
   ```bash
   scp build/libs/myapp-0.0.1-SNAPSHOT.jar hiejima@192.168.100.102:/home/hiejima/Desktop/MyReservationApp/build/libs/
   ```

3. **Pi上で再起動**
   ```bash
   ssh hiejima@192.168.100.102 "pkill -f myapp; sleep 2; cd /home/hiejima/Desktop/MyReservationApp && nohup bash start.sh > logs/app.log 2>&1 &"
   ```

4. `http://192.168.100.102:8080/reservation` で確認

## 実装済み機能レビュー（2026-04-06）

### 1. 曜日ヘッダーの同期
- `repeat(7, minmax(${minW}px, 1fr))` を `.weekday-header-row` と `#month-grid` 両方に適用
- CSSの固定 `min-width: 700px` を削除しJS制御に統一
- `1fr` だとコンテンツ量で列幅がズレるため `minmax` 固定幅で完全同期

### 2. ズームコントロール（25〜200%）
- HTMLに `−/+ ボタン`・`range スライダー`・`number 入力` を追加
- `zoomLevel` state（25〜200）で month/week 共通管理
- `applyZoom(level)` で weekHourPx と月列幅を連動更新

### 3. ズームの中心 = 表示領域中央
- month: `scrollLeft + clientWidth/2` を中心比率として保持し、再レンダ後に復元
- week: `scrollTop + clientHeight/2` を中心比率として保持し、再レンダ後に復元

### 4. week表示の Ctrl+スクロールズーム（中央基準）
- `calAreaEl.wheel` リスナーを `view === 'week'` と `view === 'month'` 両方に対応
- 中心比率計算後に `weekHourPx` を更新、再レンダ後にスクロール位置を補正

### 5. ヘッダーボタン高さ統一（36px）
- `.ext-link` と `.btn-log` に `height: 36px; display: inline-flex; align-items: center` を追加

### ズームのレイアウト動作
- 縮小時: `minmax` の `1fr` で画面幅いっぱいに広がる（空白なし）
- 拡大時: `minW * 7` を超えると横スクロール発生

## 注意事項

- SSH鍵未設定のため `deploy.sh` はClaude Codeから実行不可。Terminal.appから手動で実行すること
- `./gradlew bootRun` はログが `logs/app.log` に出力される（ターミナルでは非表示）
- ローカル実行中は `pkill -f myapp` で停止できる
