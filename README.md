# Card Conjurer
Card Conjurer was created by a passionate Magic the Gathering player and grew to become probably the most popular online card generator known to the game.
In November of 2022, Wizards of the Coast served the original creator and webhost of the site with Ceas and Desist paperwork, forcing the site offline.
This repository is for the purpose of making the application usable on your local machine and maintaining templates in perpetuity.
## Setup
- Clone this repo somewhere on your system. (Or download the Zip with CODE > Download Zip above)
- Run server.exe (or mac-server for MacOS, linux-server for linux)
- You're good to go! You could also set up Card Conjurer in a more traditional method using WAMP, Docker, XAMPP, etc.


[![Donate](https://img.shields.io/badge/Donate-PayPal-blue.svg?longCache=true&style=popout)](https://www.paypal.me/kyleburtondonate
) ← Help out Card Conjurer's original creator, Kyle. We love you buddy.


## Start with Docker (http://localhost:4242/)

<details>
  <summary>Install Make on Ubuntu</summary>

  ```bash
  $ sudo apt update
  ```

  check is make installed

  ```bash
  $ make -version
  ```

  after run this command, you got the following error? 
  
  - **bash: /usr/bin/make: No such file or directory**

  then follow with the next step, otherwise skip the next commands

  ```bash
  $ sudo apt install make
  ```

### Troubleshooting's? 
 * Follow this guide https://linuxhint.com/install-make-ubuntu/
</details>

<details>
  <summary>Install Make on Mac</summary>

  check is make installed

  ```bash
  $ make -version
  ```

  after run this command, you got the following error? 
  
  - **zsh: command not found: make**

  then follow with the next step, otherwise skip the next commands

  ```bash
  $ (sudo) brew install make
  ```
</details>

<details>
  <summary>Install Make on Windows</summary>

  Follow this Guide
  https://sp21.datastructur.es/materials/guides/make-install.html#windows-installation
</details>

* go to the downloaded/ cloned folder with your terminal/ powershell (windows) and run the following command

```bash
$ make start
```

Open your Browser with the following URL 

http://localhost:4242/

### Important

Be sure, that you are running Docker Desktop under Windows or Mac before you can run the make command.

## Using Local Images

If you're saving a lot of cards custom images you might hit the data limit for uploaded images (about 2MB).

You can avoid this by putting the image files in the `local_art` directory of this repo. Then, when selecting the image in the Art tab of the card creator, instead of uploading the image you can type the file name in the "Via URL" field. This will use the image directly from the `local_art` directory instead of needing to store the whole image in the save file.

For example if you add the file:
`cardconjurer/local_art/my_art.jpg`

You can load it in the "Via URL" box by typing:
`my_art.jpg`
then hitting enter.

## Sets workspace

The card creator stores every card inside a set. On first launch it creates `Untitled Set` (`UT1`) with one blank Common card numbered `0001`. New sets continue with `UT2`, `UT3`, and so on.

Sets and cards save continuously in the browser's IndexedDB storage. There are no Save or Cancel buttons. Undo and redo also persist across reloads, with the latest 40 actions retained for each set. This data is local to the browser profile and device, so export important work regularly before clearing browser data or moving to another computer.

The Sets panel provides:

- a searchable card list with collector, alphabetical, and mana-value sorting;
- color, color-identity, rarity, and card-type filters;
- shared set details, Markdown story preview, rarity symbols, set code, language, copyright, and collector format;
- automatic Post-ONE (`0001`) or Pre-ONE (`001/123`) numbering;
- duplicate, same-frame art variant, treatment variant, move, copy, delete, and universal undo actions;
- one-card `.cardconjurer-card` and whole-set `.cardconjurer-set` imports and exports;
- a separate ZIP download containing the rendered images for every card in the active set.

Lettered art variants such as `002a` and `002b` share one collector slot. In Pre-ONE formatting they therefore share the same denominator; a following independent card is `003/003`, even though four image files exist. Treatment variants receive independent collector slots.

Portable card and set files retain external image URLs as URLs and embed images that were uploaded from disk. They preserve frame choice, layers, art positioning, text layout, symbol placement, and the other card-specific rendering settings. Importing a card into a set applies that set's shared symbol, code, language, and copyright values. When a set import matches an existing name or code, the app asks whether to merge or replace it.
