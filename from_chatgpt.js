// First run `npm run open-chatgpt`, login and open the correct conversation.
// Then run `npm run import-commits` which runs this script and
// connects to the open browser tab to export the chat history.

const puppeteer = require('puppeteer-core');
const fs = require('fs/promises');
const cheerio = require('cheerio');
const child_process = require('child_process');

const conversationFile = 'chatgpt_conversation.html';
const codeTargetFile = 'index.html';
const codeTargetLanguage = 'html'; // .language-<codeTargetLanguage> class
const commitMessageFile = 'commit_message.txt';

async function exportChatHistory() {
  // Export the HTML content of the ChatGPT page to a file
  // This step could be cached, but it's fast enough to just do it every time
  // I'll add add a --from-cache option when I don't feel like logging in
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
  // Commit each code block with its surrounding text as the commit message
  for (const codeElement of $codeBlocks) {
    const code = $(codeElement).text();
    const $message = $(codeElement).closest('.prose');
    // elide the code block (and outer pre element, which includes a copy button) from the commit message
    const $placeholder = $("<span></span>").text("\n<code>\n");
    $(codeElement).closest('pre').replaceWith($placeholder);
    const $previousMessage = $message.closest(".group").prev().find('.prose');
    const prompt = $previousMessage.text().trim();
    const responseMinusCode = $message.text().trim();
    const message = `Commit with ChatGPT\n\nChatGPT prompt:\n${formatQuote(prompt)}\n\nChatGPT response:\n${formatQuote(responseMinusCode)}`;
    
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
  await exportChatHistory();
  await commitCodeBlocks();
}

updateRepository()
  .then(() => console.log('Repository updated successfully!'))
  .catch((err) => console.error('Error occurred:', err));
