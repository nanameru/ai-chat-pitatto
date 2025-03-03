// Web検索モード切替テスト
console.log('Web検索モード切替テスト開始');

// カスタムイベントのリスナーを追加
window.addEventListener('websearch-mode-changed', (event) => {
  console.log('websearch-mode-changedイベントを受信:', event.detail);
});

// LocalStorageの値を確認
const checkLocalStorage = () => {
  try {
    const value = localStorage.getItem('isWebSearchEnabled');
    console.log(`LocalStorage値: isWebSearchEnabled = ${value}`);
    return value;
  } catch (error) {
    console.error('LocalStorage確認エラー:', error);
    return null;
  }
};

// 初期値を確認
console.log('初期状態:');
checkLocalStorage();

// テスト実行方法:
// 1. このスクリプトをブラウザコンソールにコピー&ペースト
// 2. Web検索ボタンをクリック
// 3. コンソールログを確認
// 4. もう一度ボタンをクリックして状態が切り替わることを確認

console.log('Web検索ボタンをクリックしてテストを実行してください');
