import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';

type Platform = 'darwin' | 'win32' | 'linux' | string;

const execPromise = promisify(exec);

/**
 * スクリーンショットを撮影してBase64エンコードされた文字列を返す
 * macOS、Windows、Linuxに対応
 */
export async function captureScreenshot(): Promise<string> {
  const platform = os.platform();
  const tempDir = os.tmpdir();
  const screenshotPath = path.join(tempDir, `screenshot-${Date.now()}.png`);

  try {
    // OSに応じたスクリーンショットコマンドを実行
    if (platform === 'darwin') {
      // macOS
      await execPromise(`screencapture -x ${screenshotPath}`);
    } else if (platform === 'win32') {
      // Windows - PowerShellを使用
      await execPromise(`
        Add-Type -AssemblyName System.Windows.Forms
        Add-Type -AssemblyName System.Drawing
        $screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
        $bitmap = New-Object System.Drawing.Bitmap $screen.Width, $screen.Height
        $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
        $graphics.CopyFromScreen($screen.X, $screen.Y, 0, 0, $screen.Size)
        $bitmap.Save("${screenshotPath}")
        $graphics.Dispose()
        $bitmap.Dispose()
      `, { shell: 'powershell.exe' });
    } else if (platform === 'linux') {
      // Linux - gnome-screenshotを使用
      await execPromise(`gnome-screenshot -f ${screenshotPath}`);
    } else {
      throw new Error(`Unsupported platform: ${platform}`);
    }

    // スクリーンショットをBase64エンコード
    const imageBuffer = fs.readFileSync(screenshotPath);
    const base64Image = imageBuffer.toString('base64');

    // 一時ファイルを削除
    fs.unlinkSync(screenshotPath);

    return base64Image;
  } catch (error) {
    console.error('Error capturing screenshot:', error);
    throw error;
  }
}
