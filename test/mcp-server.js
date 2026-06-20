import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let buffer = '';
process.stdin.on('data', chunk => {
  buffer += chunk.toString();
  let lineEnd;
  while ((lineEnd = buffer.indexOf('\n')) !== -1) {
    const line = buffer.slice(0, lineEnd);
    buffer = buffer.slice(lineEnd + 1);
    if (line.trim()) {
      try {
        handleMessage(JSON.parse(line));
      } catch (err) {
        console.error('Failed to parse JSON-RPC message:', err);
      }
    }
  }
});

function sendResponse(id, result) {
  process.stdout.write(JSON.stringify({
    jsonrpc: '2.0',
    id,
    result
  }) + '\n');
}

function sendError(id, code, message) {
  process.stdout.write(JSON.stringify({
    jsonrpc: '2.0',
    id,
    error: { code, message }
  }) + '\n');
}

function handleMessage(message) {
  const { method, params, id } = message;

  if (method === 'initialize') {
    sendResponse(id, {
      protocolVersion: '2024-11-05',
      capabilities: {
        tools: {}
      },
      serverInfo: {
        name: 'image-tagger-test-server',
        version: '1.0.0'
      }
    });
  } else if (method === 'tools/list') {
    sendResponse(id, {
      tools: [
        {
          name: 'run_ui_tests',
          description: 'Runs browser UI tests on Image Tagger using Chromium inside the Nix dev shell.',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        }
      ]
    });
  } else if (method === 'tools/call') {
    if (params.name === 'run_ui_tests') {
      runUiTests(id);
    } else {
      sendError(id, -32601, `Tool not found: ${params.name}`);
    }
  }
}

function runUiTests(id) {
  const testScript = path.join(__dirname, 'ui-test.js');
  const child = spawn('node', [testScript], {
    env: {
      ...process.env
    }
  });

  let output = '';
  child.stdout.on('data', data => {
    output += data.toString();
  });
  child.stderr.on('data', data => {
    output += data.toString();
  });

  child.on('close', code => {
    const success = code === 0;
    sendResponse(id, {
      content: [
        {
          type: 'text',
          text: `Test Exit Code: ${code}\n\nOutput Log:\n${output}`
        }
      ],
      isError: !success
    });
  });
}
