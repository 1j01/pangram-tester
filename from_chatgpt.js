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

function markMessageContentElements() {
  // Unfortunately, OpenAI uses only presentational CSS classes.
  // Use the largest font size to guess which element contains the message content.
  // This will fail if there is a heading in the message.
  // Also, how will this distinguish between inner and outer elements which may share a font size?
  // TODO: find a new strategy for identifying message content elements

  function findElementWithLargestFontSize(element) {
    let largestFontSize = -Infinity;
    let elementWithLargestFontSize = null;
  
    const traverseDescendants = (currentElement) => {
      const children = currentElement.children;
      for (let i = 0; i < children.length; i++) {
        const child = children[i];
        const computedStyle = window.getComputedStyle(child);
        const fontSize = parseFloat(computedStyle.fontSize);
  
        if (fontSize > largestFontSize) {
          largestFontSize = fontSize;
          elementWithLargestFontSize = child;
        }
  
        traverseDescendants(child); // Recursively traverse nested elements
      }
    };
  
    traverseDescendants(element);
  
    return elementWithLargestFontSize;
  }
  
  // TODO: see if .group contains other messages in non-linear conversations
  const messageElements = document.querySelectorAll('.group');
  for (const messageElement of messageElements) {
    const contentElement = findElementWithLargestFontSize(messageElement);
    contentElement.classList.add('best-guess-for-message-content');
  }
}

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
  const $messages = $(".group");
  console.log(`Found ${$codeBlocks.length} ${codeTargetLanguage} code blocks, ${$messages.length} messages`);
  // Commit each code block with its surrounding text as the commit message
  for (const codeElement of $codeBlocks) {
    const code = $(codeElement).text();
    const $message = $(codeElement).closest('.group');
    // elide the code block (and outer pre element, which includes a copy button) from the commit message
    const $placeholder = $("<span></span>").text("\n\n<code>\n\n");
    $(codeElement).closest('pre').replaceWith($placeholder);
    // const $previousMessage = $message.closest(".group").prev().find('.prose');
    const messageIndex = $messages.index($message[0]);
    if (messageIndex === 0) {
      console.error('WARNING: Skipping first message. Note that code sent as part of a prompt is not handled correctly yet. It may be skipped (like this) or mislabeled as a ChatGPT response.');
      continue;
    }
    if (messageIndex === -1) {
      console.error('ERROR: Could not find message index');
      continue;
    }
    const $previousMessage = $($messages[messageIndex - 1]);
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
