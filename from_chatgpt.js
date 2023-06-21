// First run `npm run open-chatgpt`, login and open the correct conversation.
// Then run `npm run import-commits` which runs this script and
// connects to the open browser tab to export the chat history.

const puppeteer = require('puppeteer-core');
const fs = require('fs/promises');
const cheerio = require('cheerio');
const child_process = require('child_process');

const dryRun = process.argv.includes('--dry-run');
const fromCache = process.argv.includes('--from-cache');
const force = process.argv.includes('--force');

const conversationFile = 'chatgpt_conversation.html';
const codeTargetFile = 'index.html';
const codeTargetLanguage = 'html'; // .language-<codeTargetLanguage> class
const commitMessageFile = 'commit_message.txt';

const isWorkingDirectoryClean = () => {
  try {
    child_process.execSync('git update-index --really-refresh -q');
    child_process.execSync('git diff --quiet HEAD --');
    child_process.execSync('git diff-index --quiet HEAD --');
    // Handle untracked files
    const output = child_process.execSync('git status --porcelain').toString();
    const untrackedRegex = /^\?\?/m;
    return !untrackedRegex.test(output);
  } catch (error) {
    return false;
  }
};

async function exportChatHistory() {
  // Export the HTML content of the ChatGPT page to a file
  const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222/json' });
  const pages = await browser.pages();
  const chatPage = pages.find((page) => page.url().startsWith('https://chat.openai.com/'));

  const html = await chatPage.content();
  await fs.writeFile(conversationFile, html);

  await browser.disconnect();
}

function formatQuote(text) {
  return text.split('\n').map((line) => `> ${line}`).join('\n');
}

async function commitCodeBlocks() {
  const html = await fs.readFile(conversationFile, 'utf-8');
  const $ = cheerio.load(html);
  const $codeBlocks = $(`code.language-${codeTargetLanguage}`);
  console.log(`Found ${$codeBlocks.length} ${codeTargetLanguage} code blocks`);
  // Make a commit for each new code block, with the prompt and response in the commit message
  let foundLatestCommitted = false;
  let latestCode;
  try {
    latestCode = await fs.readFile(codeTargetFile, 'utf-8');
  } catch (err) {
    if (err.code !== 'ENOENT') {
      throw err;
    }
    // No code found, so this will be the first commit
    foundLatestCommitted = true;
  }
  for (const codeElement of $codeBlocks) {
    const code = $(codeElement).text();
    if (code === latestCode) {
      foundLatestCommitted = true;
      continue;
    }
    if (!foundLatestCommitted) {
      // Skip code blocks until we find the code in the working directory (i.e. latest commit)
      continue;
    }

    const $message = $(codeElement).closest('.prose');
    if ($message.length === 0) {
      // This is a code block in a prompt, not a response (or the HTML structure has changed)
      // TODO: make a commit for this case too, but with a different message,
      // as this implies user-supplied code.
      continue;
    }
    // elide the code block (and outer pre element, which includes a copy button) from the commit message
    const $placeholder = $('<span></span>').text('\n\n<code>\n\n');
    $(codeElement).closest('pre').replaceWith($placeholder);
    // Responses have .markdown.prose elements, prompts have plain div elements
    const $promptMessage = $message.closest('.group').prev().find('div:not([class])');
    if ($promptMessage.length === 0) {
      // The HTML structure has changed
      console.error('Could not find prompt message for code block:', code);
    }
    const prompt = $promptMessage.text().trim();
    const responseMinusCode = $message.text().trim();
    const summary = `[GPT] ${prompt.slice(0, 50).split('\n')[0]}...`;
    const message = `${summary}\n\nChatGPT prompt:\n${formatQuote(prompt)}\n\nChatGPT response:\n${formatQuote(responseMinusCode)}`;

    if (dryRun) {
      console.log(`Dry run: would commit code:\n${code}\n\nwith message:\n${message}`);
      continue;
    }
    await fs.writeFile(codeTargetFile, code);
    await fs.writeFile(commitMessageFile, message);
    await new Promise((resolve, reject) => {
      const child = child_process.exec(`git add ${codeTargetFile} && git commit -F ${commitMessageFile}`, (err) => {
        if (err) {
          console.error('Error committing code block:', err);
          reject(err);
        } else {
          // awkward api? adding listeners here is too late btw
        }
      });
      child.stdout.on('data', (data) => {
        console.log(`stdout: ${data}`);
      });
      child.stderr.on('data', (data) => {
        console.error(`stderr: ${data}`);
      });
      child.on('close', (code) => {
        console.log(`child process exited with code ${code}`);
        resolve();
      });
    });
  }
  if (!foundLatestCommitted) {
    console.error('Could not find current code in the chat history.');
    process.exit(1);
  }
}

async function updateRepository() {
  if (!isWorkingDirectoryClean()) {
    if (force) {
      console.warn('Working directory is not clean, but --force was specified. Continuing anyway.');
    } else {
      console.error('Working directory is not clean. Please commit or stash your changes first.\nOr use --force to continue anyway.');
      process.exit(1);
    }
  }
  if (!fromCache) {
    await exportChatHistory();
  }
  await commitCodeBlocks();
}

updateRepository()
  .then(() => console.log(dryRun ? 'Dry run complete.' : 'Done.'))
  .catch((err) => console.error('Error occurred:', err));
