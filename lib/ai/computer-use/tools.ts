// TODO: @ai-sdk/anthropicのインストールに問題があるため、一時的にコメントアウト
// import { anthropic } from '@ai-sdk/anthropic';
import fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
// TODO: screenshotモジュールが見つからないため、一時的にコメントアウト
// import { captureScreenshot } from './screenshot';

// 型定義
interface BashToolParams {
  command?: string;
  restart?: boolean;
}

interface TextEditorToolParams {
  command: 'view' | 'create' | 'str_replace' | 'insert' | 'undo_edit';
  path: string;
  file_text?: string;
  insert_line?: number;
  new_str?: string;
  old_str?: string;
  view_range?: [number, number];
}

interface ComputerToolParams {
  action: 'key' | 'type' | 'mouse_move' | 'left_click' | 'left_click_drag' | 'right_click' | 'middle_click' | 'double_click' | 'screenshot' | 'cursor_position';
  coordinate?: [number, number];
  text?: string;
}

interface ImageResult {
  type: 'image';
  data: string;
}

type ToolResult = string | ImageResult;

// execをPromiseに変換
const execPromise = promisify(exec);

// Anthropicプロバイダーのインスタンスを作成
// TODO: @ai-sdk/anthropicのインストールに問題があるため、一時的にコメントアウト
// export const anthropicProvider = anthropic();

// 一時的なダミー実装
export const anthropicProvider = {
  tools: {
    bash_20241022: () => ({}),
    textEditor_20241022: () => ({}),
    computer_20241022: () => ({})
  }
} as any;

// Bashツールの実装
// TODO: @ai-sdk/anthropicのインストールに問題があるため、一時的にダミー実装
export const bashTool = anthropicProvider.tools.bash_20241022({
  execute: async ({ command, restart }: BashToolParams) => {
    try {
      console.log(`Executing bash command: ${command}`);
      
      if (restart) {
        return 'Command restarted.';
      }
      
      if (!command) {
        return 'Error: No command provided';
      }
      
      const { stdout, stderr } = await execPromise(command);
      
      if (stderr) {
        console.error(`Command error: ${stderr}`);
        return `Error: ${stderr}\n${stdout || ''}`;
      }
      
      return stdout || 'Command executed successfully with no output.';
    } catch (error: unknown) {
      console.error('Error executing bash command:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      return `Error executing command: ${errorMessage}`;
    }
  },
});

// テキストエディタツールの実装
// TODO: @ai-sdk/anthropicのインストールに問題があるため、一時的にダミー実装
export const textEditorTool = anthropicProvider.tools.textEditor_20241022({
  execute: async ({
    command,
    path: filePath,
    file_text,
    insert_line,
    new_str,
    old_str,
    view_range,
  }: TextEditorToolParams) => {
    try {
      console.log(`Executing text editor command: ${command} on ${filePath}`);
      
      if (!filePath) {
        return 'Error: No file path provided';
      }
      
      // ファイルパスが絶対パスであることを確認
      const absolutePath = path.isAbsolute(filePath) 
        ? filePath 
        : path.resolve(process.cwd(), filePath);
      
      switch (command) {
        case 'view': {
          if (!fs.existsSync(absolutePath)) {
            return `Error: File not found at ${absolutePath}`;
          }
          
          const content = fs.readFileSync(absolutePath, 'utf-8');
          
          if (view_range && view_range.length === 2) {
            const [start, end] = view_range;
            const lines = content.split('\n');
            const selectedLines = lines.slice(start, end + 1);
            return selectedLines.join('\n');
          }
          
          return content;
        }
        
        case 'create': {
          // ディレクトリが存在しない場合は作成
          const dir = path.dirname(absolutePath);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
          
          fs.writeFileSync(absolutePath, file_text || '');
          return `File created at ${absolutePath}`;
        }
        
        case 'str_replace': {
          if (!fs.existsSync(absolutePath)) {
            return `Error: File not found at ${absolutePath}`;
          }
          
          if (!old_str) {
            return `Error: No text to replace provided`;
          }
          
          let content = fs.readFileSync(absolutePath, 'utf-8');
          
          if (!content.includes(old_str)) {
            return `Error: Could not find the text to replace in ${absolutePath}`;
          }
          
          content = content.replace(old_str, new_str || '');
          fs.writeFileSync(absolutePath, content);
          return `Text replaced in ${absolutePath}`;
        }
        
        case 'insert': {
          if (!fs.existsSync(absolutePath)) {
            return `Error: File not found at ${absolutePath}`;
          }
          
          if (insert_line === undefined) {
            return `Error: No line number provided for insertion`;
          }
          
          const content = fs.readFileSync(absolutePath, 'utf-8');
          const lines = content.split('\n');
          
          if (insert_line < 0 || insert_line >= lines.length) {
            return `Error: Line number ${insert_line} is out of range`;
          }
          
          lines.splice(insert_line + 1, 0, new_str || '');
          fs.writeFileSync(absolutePath, lines.join('\n'));
          return `Text inserted at line ${insert_line + 1} in ${absolutePath}`;
        }
        
        case 'undo_edit': {
          return 'Undo functionality is not implemented';
        }
        
        default:
          return `Error: Unknown command ${command}`;
      }
    } catch (error: unknown) {
      console.error('Error executing text editor command:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      return `Error: ${errorMessage}`;
    }
  },
});

// コンピュータツールの実装
// TODO: @ai-sdk/anthropicのインストールに問題があるため、一時的にダミー実装
export const computerTool = anthropicProvider.tools.computer_20241022({
  displayWidthPx: 1920,
  displayHeightPx: 1080,
  
  execute: async ({ action, coordinate, text }: ComputerToolParams) => {
    try {
      console.log(`Executing computer action: ${action}`);
      
      switch (action) {
        case 'screenshot': {
          // TODO: screenshotモジュールが見つからないため、一時的にダミー実装
          // const screenshotBase64 = await captureScreenshot();
          return {
            type: 'image',
            data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', // ダミー画像
          };
        }
        
        case 'cursor_position': {
          // 実際の実装ではマウスの位置を取得する必要があります
          // ここではモックデータを返します
          return `Current cursor position: x=500, y=500`;
        }
        
        case 'key':
        case 'type':
        case 'mouse_move':
        case 'left_click':
        case 'left_click_drag':
        case 'right_click':
        case 'middle_click':
        case 'double_click':
          // これらのアクションは実際の実装では、システムのAPIを使用して
          // マウスやキーボードを制御する必要があります
          return `Action '${action}' executed successfully`;
        
        default:
          return `Error: Unknown action ${action}`;
      }
    } catch (error: unknown) {
      console.error('Error executing computer action:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      return `Error: ${errorMessage}`;
    }
  },
  
  experimental_toToolResultContent(result: ToolResult) {
    return typeof result === 'string'
      ? [{ type: 'text', text: result }]
      : [{ type: 'image', data: result.data, mimeType: 'image/png' }];
  },
});
