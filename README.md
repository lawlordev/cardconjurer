# Set Conjurer

Set Conjurer is a local-first desktop app for creating custom cards and complete custom sets. Your cards, sets, images, and frame packs stay on your computer—there are no accounts, cloud storage, or telemetry.

## Download

Choose the installer that matches your computer:

| Platform | Download |
| --- | --- |
| Windows 10/11 (64-bit) | [Download Set Conjurer for Windows](https://github.com/lawlordev/cardconjurer/releases/latest/download/Set-Conjurer-Windows-x64-Setup.exe) |
| macOS on an Intel Mac | [Download Set Conjurer for Intel Mac](https://github.com/lawlordev/cardconjurer/releases/latest/download/Set-Conjurer-x64.dmg) |
| macOS on an M-series Mac | [Download Set Conjurer for Apple silicon](https://github.com/lawlordev/cardconjurer/releases/latest/download/Set-Conjurer-arm64.dmg) |

Not sure which Mac you have? Open the Apple menu, choose **About This Mac**, and check whether the chip says Intel or Apple M1/M2/M3/M4/M5.

[View all releases, including beta versions](https://github.com/lawlordev/cardconjurer/releases).

On Windows, run the downloaded Setup file once. After installation, launch **Set Conjurer** from the Start menu or desktop shortcut; you do not need to reopen the copy in Downloads. Windows Installed Apps is also the normal place to uninstall it.

First launch shows the download size of every frame pack and the combined size of your selection before downloading. Set Symbols and Standard are required; the other packs are optional. Downloads are written directly to disk, resume after a connection interruption or restart, and use one overall progress indicator. Keep enough free space for both the shown download and the installed files. Application data and packs remain under your Windows user profile when the app is upgraded.

## Developer setup

Install [Node.js 24](https://nodejs.org/), then run:

```sh
git clone https://github.com/lawlordev/cardconjurer.git
cd cardconjurer
npm ci
npm run packs:compile
npm run dev
```

`npm run dev` opens the Electron app and automatically reloads changes to the card editor's HTML, CSS, JavaScript, frame definitions, and frame images. If you change files inside `desktop/`, stop the process and run `npm run dev` again.

To use the browser version at `http://localhost:8081` instead, run:

```sh
npm run start:browser
```

Before submitting a change, run:

```sh
npm test
npm run typecheck
npm run lint
```

More detail is available in [desktop development](docs/desktop-development.md) and [release instructions](docs/desktop-release.md).

## Credits

Set Conjurer is a desktop fork of [Card Conjurer](https://github.com/joshbirnholz/cardconjurer), originally created by [Kyle Burton (`@ImKyle4815`)](https://github.com/ImKyle4815). This fork descends from the branch maintained by [Josh Birnholz (`@joshbirnholz`)](https://github.com/joshbirnholz), with major upstream contributions from [`@AModSoul`](https://github.com/AModSoul) and [Noah Kantrowitz (`@coderanger`)](https://github.com/coderanger), among [many other contributors](https://github.com/joshbirnholz/cardconjurer/graphs/contributors).

The Set Conjurer name and desktop work do not remove or replace anyone's credit or ownership of their contributions.

Set Conjurer is unofficial Fan Content permitted under the [Wizards of the Coast Fan Content Policy](https://company.wizards.com/en/legal/fancontentpolicy). Not approved/endorsed by Wizards. Portions of the materials used are property of Wizards of the Coast. ©Wizards of the Coast LLC.

## License

The Card Conjurer source repository included the GNU General Public License v3.0 from its initial 2018 commit. Set Conjurer preserves that license and is distributed under the [GNU GPL v3.0](LICENSE).

The GPL applies to the software source code. It does not grant rights to Magic: The Gathering names, symbols, card frames, artwork, or other Wizards of the Coast intellectual property.
