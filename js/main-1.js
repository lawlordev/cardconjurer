function toggleMenu() {
	if (document.querySelector('.hamburger').classList.contains('opened')) {
		document.querySelector('.hamburger').classList.remove('opened');
		Array.from(document.querySelectorAll('.menu-visible')).forEach(element => element.classList.remove('menu-visible'));
	} else {
		document.documentElement.style.setProperty('--window-diagonal-size', (Math.floor(Math.sqrt(window.innerWidth ** 2 + window.innerHeight ** 2)) + 100) + 'px');
		document.querySelector('.hamburger').classList.add('opened');
		document.querySelector('.menu').classList.add('menu-visible');
	}
}
function notify(message = '', seconds) {
	var notification = document.createElement('div');
	notification.classList = 'notification padding';
	var notificationMessage = document.createElement('h4');
	notificationMessage.innerHTML = message;
	notification.appendChild(notificationMessage);
	var close = document.createElement('h3');
	close.innerHTML = 'X';
	close.onclick = closeNotification;
	notification.appendChild(close);
	document.querySelector('.notification-container').appendChild(notification);
	if (seconds) {
		setTimeout(function(){close.click();}, seconds * 1000)
	}
}
function closeNotification(event) {
	var target = event.target.closest('.notification');
	target.classList.add('hidden');
	setTimeout(function(){target.remove();}, 500);
}
window.onload = function() {
	Array.from(document.querySelectorAll('input')).forEach(element => {
		element.autocomplete = 'off';
	});
}

// Drop to upload
const droppables = document.querySelectorAll('.drop-area');
Array.from(droppables).forEach(element => {
	element.addEventListener('dragenter', dropEnter, false);
	element.addEventListener('dragleave', dropLeave, false);
	element.addEventListener('dragover', dropOver, false);
	element.addEventListener('drop', dropDrop, false);
	element.children[1].addEventListener('click', function() {
		this.value = null;
	}, false);
})
function dropEnter(e) {
	e.preventDefault();
	e.stopPropagation();
	e.target.closest('.drop-area').classList.add('hover');
}
function dropLeave(e) {
	e.preventDefault();
	e.stopPropagation();
	e.target.closest('.drop-area').classList.remove('hover');
}
function dropOver(e) {
	e.preventDefault();
	e.stopPropagation();
	e.target.closest('.drop-area').classList.add('hover');
}
function dropDrop(e) {
	e.preventDefault();
	e.stopPropagation();
	e.target.closest('.drop-area').classList.remove('hover');
	destination = window[e.target.closest('.drop-area')?.querySelector("input").getAttribute('data-dropFunction')];
	otherParams = e.target.closest('.drop-area')?.querySelector("input").getAttribute('data-otherParams');
	uploadFiles(e.dataTransfer.files, destination, otherParams);
}
async function uploadFiles(filesRaw, destination, otherParams = '') {
	var files = ([...filesRaw]);
	if (files.length > 9) {
		if (!confirm('You are uploading ' + files.length + ' images. Would you like to continue?')) {
			return;
		}
	}
	files.forEach(file => {
		var reader = new FileReader();
		reader.onloadend = function () {
			if (otherParams.includes('filename')) {
				otherParams = 'filename=' + file.name;
			}
			destination(reader.result, otherParams);
		}
		reader.onerror = function () {
			destination('/img/blank.png', otherParams);
		}
		reader.readAsDataURL(file);
	})
}

//Collapsible elements
function toggleCollapse(event) {
	event.target.closest('.collapsible').classList.toggle('collapsed');
}

//Input same value still enters
const urlInputs = Array.from(document.querySelectorAll('input[type=url]'));
urlInputs.forEach(element => {
	element.addEventListener('keyup', function(event) {
		if (event.keyCode === 13) {
			event.preventDefault();
			element.dispatchEvent(new Event('change'));
		}
	});
});

//bind two inputs to match values
function bindInputs(query1, query2, checkbox = false) {
	var e1 = document.querySelector(query1);
	var e2 = document.querySelector(query2);
	if (checkbox) {
		e1.oninput = (event) => {e2.checked = e1.checked;}
		e2.oninput = (event) => {e1.checked = e2.checked;}
	} else {
		e1.oninput = (event) => {e2.value = e1.value;}
		e2.oninput = (event) => {e1.value = e2.value;}
	}
}

var creatorScriptsLoading = null;
function loadCreatorScripts(root) {
	var manifest = (root || document).querySelector && (root || document).querySelector('#creator-script-manifest');
	if (!manifest || window.CardConjurerSets || creatorScriptsLoading) return creatorScriptsLoading;
	var sources = String(manifest.dataset.scripts || '').split(',').filter(Boolean);
	creatorScriptsLoading = sources.reduce(function(chain, source) {
		return chain.then(function() {
			return new Promise(function(resolve, reject) {
				var script = document.createElement('script');
				script.src = source;
				script.onload = resolve;
				script.onerror = function() { reject(new Error('Could not load ' + source)); };
				document.body.appendChild(script);
			});
		});
	}, Promise.resolve()).catch(function(error) {
		creatorScriptsLoading = null;
		console.error(error);
		var status = document.querySelector('#sets-global-status');
		if (status) status.textContent = 'Creator failed to load';
	});
	return creatorScriptsLoading;
}

document.body.addEventListener('htmx:afterSwap', function(event) { loadCreatorScripts(event.target); });

function setSetsDrawerOpen(open, trigger) {
	var drawer = document.querySelector('#sets-workspace');
	var toggle = document.querySelector('#sets-drawer-toggle');
	var button = document.querySelector('#sets-drawer-open');
	if (toggle) toggle.checked = open;
	if (drawer) drawer.classList.toggle('opened', open);
	if (button) button.setAttribute('aria-expanded', open ? 'true' : 'false');
	document.body.classList.toggle('sets-drawer-active', open);
	if (open) {
		setTimeout(function() { document.querySelector('.sets-drawer-close')?.focus(); }, 0);
	} else if (trigger && trigger.isConnected) trigger.focus();
}

document.addEventListener('change', function(event) {
	if (event.target.id === 'sets-drawer-toggle') setSetsDrawerOpen(event.target.checked, document.querySelector('#sets-drawer-open'));
});

document.addEventListener('keydown', function(event) {
	if (event.key === 'Escape' && document.querySelector('#sets-drawer-toggle')?.checked) setSetsDrawerOpen(false, document.querySelector('#sets-drawer-open'));
});

window.addEventListener('load', function() {
	// Start the creator after the app shell's load event so the initial navigation
	// remains responsive while its ordered rendering bundle initializes.
	setTimeout(function() { document.body.dispatchEvent(new Event('doCreate')); }, 0);
})

document.onkeyup = function(e) {
	if (document.activeElement === document.getElementById('text-editor')) {
		if (e.ctrlKey && e.which == 73) {
			toggleTextTag('i');

			e.preventDefault();
		}
	}
}
