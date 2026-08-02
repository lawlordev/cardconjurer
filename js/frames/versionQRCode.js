//checks to see if it needs to run
if (!loadedVersions.includes('/js/frames/versionQRCode.js')) {
	loadedVersions.push('/js/frames/versionQRCode.js');
	card.qrCode = card.qrCode || {
		x:0.36,
		y:0.73,
		size:0.20,
		fgColor:'#fff',
		fgAlpha:1,
		bgColor:'#000',
		bgAlpha:0,
		padding:0,
		url:'https://cardconjurer.com/'
	}
	sizeCanvas('qrious');
	sizeCanvas('qrCode');
	loadScript('/js/qrious.min.js');
}

if (!card.qrCode) {
	card.qrCode = {x:0.36, y:0.73, size:0.20, fgColor:'#fff', fgAlpha:1, bgColor:'#000', bgAlpha:0, padding:0, url:'https://cardconjurer.com/'};
}

registerCardSpecificTextTools({
	key: 'qrCode',
	title: 'QR Code',
	description: 'Link the deck cover to a decklist or another web page.',
	inlineHTML: `
		<label class="card-specific-control full-width"><span>Destination URL</span><input id="qr-code-url" class="input" type="url" oninput="updateQRCode(this.value);" placeholder="https://example.com/deck"></label>`,
	layoutDescription: 'Position and size the QR code on the card.',
	layoutHTML: `
		<section class="layout-control-group">
			<div class="layout-control-heading"><h3>Position</h3><p>Coordinates from the card's top-left corner</p></div>
			<div class="layout-control-grid">
				<label class="layout-control-field"><span>X position</span><span class="layout-input-shell"><input id="qr-code-x" class="input" type="number" step="1" oninput="card.qrCode.x=this.value/card.width; updateQRCode();"><small>px</small></span></label>
				<label class="layout-control-field"><span>Y position</span><span class="layout-input-shell"><input id="qr-code-y" class="input" type="number" step="1" oninput="card.qrCode.y=this.value/card.height; updateQRCode();"><small>px</small></span></label>
			</div>
		</section>
		<section class="layout-control-group">
			<div class="layout-control-heading"><h3>Size</h3><p>QR codes stay square</p></div>
			<label class="layout-control-field"><span>Width and height</span><span class="layout-input-shell"><input id="qr-code-size" class="input" type="number" min="1" step="1" oninput="card.qrCode.size=this.value/card.height; updateQRCode();"><small>px</small></span></label>
		</section>`,
	onRender: () => {
		var values = {
			'#qr-code-url': card.qrCode.url || '',
			'#qr-code-x': scaleWidth(card.qrCode.x || 0),
			'#qr-code-y': scaleHeight(card.qrCode.y || 0),
			'#qr-code-size': scaleHeight(card.qrCode.size || 0.2)
		};
		Object.entries(values).forEach(([selector, value]) => {
			var input = document.querySelector(selector);
			if (input) input.value = value;
		});
	}
});

function updateQRCode(url = card.qrCode.url) {
	card.qrCode.url = url;
	//generate qr code
	var qr = new QRious({
		background: card.qrCode.bgColor,
		backgroundAlpha: card.qrCode.bgAlpha,
		foreground: card.qrCode.fgColor,
		foregroundAlpha: card.qrCode.fgAlpha,
		padding: scaleHeight(card.qrCode.padding),
		size: scaleHeight(card.qrCode.size),
		element: qriousCanvas,
		value: url
	});
	//draw cropped qr code to correct location
	var qrCodeContext = qrCodeCanvas.getContext('2d');
	qrCodeContext.clearRect(0, 0, qrCodeCanvas.width, qrCodeCanvas.height);
	qrCodeContext.drawImage(croppedCanvas(qriousCanvas), scaleWidth(card.qrCode.x), scaleHeight(card.qrCode.y), scaleHeight(card.qrCode.size), scaleHeight(card.qrCode.size));
	//draw the card
	drawCard();
}
