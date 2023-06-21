// First run `npm run open-chatgpt`, login and open the correct conversation.
// Then run `npm run import-commits` which runs this script and
// connects to the open browser tab to export the chat history.

const puppeteer = require('puppeteer-core');
const fs = require('fs/promises');
const cheerio = require('cheerio');
const child_process = require('child_process');

const dryRun = process.argv.includes('--dry-run');
const fromCache = process.argv.includes('--from-cache');

const conversationFile = 'chatgpt_conversation.html';
const codeTargetFile = 'index.html';
const codeTargetLanguage = 'html'; // .language-<codeTargetLanguage> class
const commitMessageFile = 'commit_message.txt';

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
  // Make a commit for each code block, with the prompt and response in the commit message
  for (const codeElement of $codeBlocks) {
    const code = $(codeElement).text();
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
    const message = `Commit with ChatGPT\n\nChatGPT prompt:\n${formatQuote(prompt)}\n\nChatGPT response:\n${formatQuote(responseMinusCode)}`;
    
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
}

async function updateRepository() {
  if (!fromCache) {
    await exportChatHistory();
  }
  await commitCodeBlocks();
}

updateRepository()
  .then(() => console.log('Repository updated successfully!'))
  .catch((err) => console.error('Error occurred:', err));
