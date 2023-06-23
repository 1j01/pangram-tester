
# Pangram Tester (and ✨ChatGPT auto-commit)

Analyzes pangram sentences as you type. [Try the app here.](https://1j01.github.io/pangram-tester/)

A pangram is a sentence that uses every letter of the alphabet at least once, such as "The quick brown fox jumps over the lazy dog."

Features:
- Configurable alphabet (e.g. for non-English languages)
- Highlights unique letters in the sentence (the first occurrence of each letter)
- Lists (and counts) missing letters
- Gives a count of the total number of letters in the sentence
- Suggests words to add based on missing letters, using a word list from [dwyl/english-words](https://github.com/dwyl/english-words). Words are scored based on the missing letters they add, and penalized for redundant letters.
- Draws arrows from redundant letters to the prior occurrence of the letter. This is a little silly, but I wanted something more *symmetrical* than just highlighting the first occurrence of each letter.
- Updates as you type

## Methodology

I just used ChatGPT to write the first fully working, and nice looking, version of this app.

I did use my programming expertise to formulate the prompts and to give some feedback on the code, but I didn't write any of the code myself (for the [first version](https://jsfiddle.net/1j01/g5rwmuqc/)).

It's interesting that it was easier to create this application using AI than to search the web for an existing solution of comparable quality.

When it came to adding the word suggestion feature, I tried several times but eventually gave up on using ChatGPT for that. It was able to scaffold out the feature, but it would freeze up the browser, or after telling it to use a web worker, it couldn't get the ranking right, among other things. It wouldn't put the worker code in a function for syntax highlighting, like I asked, etc. and once it's written the initial code, it prefers to make mild changes to it even when asking it to make structural changes, so it's an awkward decision between trying to get it to mold it or starting over so it's more plastic.

So the word suggestion and redundancy graphing are written manually, and I did a bunch of clean up once I was working with the code directly.

## ChatGPT auto-commit

Export code blocks from a ChatGPT conversation into the git commit history of a target file.

- If you make a simple app using ChatGPT, copying its results to JS Fiddle or CodePen, you can use this to automatically commit the results at each step.
- You can continue the conversation, re-run the script, and it will commit the new code without duplicating commits.
- This works by matching the current code to the chat history, and ignoring messages earlier than (or matching) the current code.
- If you create a new conversation, and paste in your current code, it should work naturally (as long as you update the conversation ID), since it doesn't need to line up the whole commit history with a whole chat history.
- If it doesn't find the current code in the chat history, it will abort with an error message. You can either paste your updated code into the chat, or copy the latest code from the chat into the file and look at the git diff to see what has changed. (The git diff will likely be reversed; if the colors bother you you could commit it, revert it, and look at the diff of the reverted commit. Or probably with some git flag.)

Caveats:
- It can only handle single-file applications. You must specify the file name and language code.
- If you include code (of the same language) in a prompt, it will be confused currently. (TODO: commit user-supplied code with a different message)
- This does not use the OpenAI API (TODO), but rather scrapes the chat history from the web page. This is fragile and will definitely break in the future.
- It does not preserve time/date information. (This should be easy to add, once it uses the API, assuming such information is provided.)
- As code gets long, ChatGPT starts to (reasonably) elide sections of code, such as CSS if unchanged. Trivial changes like adding a charset declaration may make it omit most of your code, and once it's done so, it's probably more likely to do it again. This workflow is unsustainable, but it can be fun for jump-starting a project. Eventually I gave up on using the auto-commit since I would have had to paste all my app code into the chat to sync it, and just went back to copying and pasting, and then gave up on trying to do it all with ChatGPT since it couldn't do the word suggestion feature very well.

## License

<p xmlns:dct="http://purl.org/dc/terms/" xmlns:vcard="http://www.w3.org/2001/vcard-rdf/3.0#">
  <a rel="license"
     href="https://creativecommons.org/publicdomain/zero/1.0/">
    <img src="https://i.creativecommons.org/p/zero/1.0/88x31.png" style="border-style: none;" alt="CC0" />
  </a>
  <br />
  To the extent possible under law,
  <a rel="dct:publisher"
     href="https://isaiahodhner.io">
    <span property="dct:title">Isaiah Odhner</span></a>
  has waived all copyright and related or neighboring rights to
  <span property="dct:title">Pangram Tester</span>.
This work is published from:
<span property="vcard:Country" datatype="dct:ISO3166"
      content="US" about="https://isaiahodhner.io">
  United States</span>.
</p>
