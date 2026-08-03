(function(root) {
	'use strict';
	if (new URLSearchParams(root.location.search).get('desktop') !== '1') return;
	var element = root.document.documentElement;
	element.classList.add('desktop-booting');
	root.SetConjurerBoot = {
		finish: function() {
			element.classList.remove('desktop-booting');
			element.classList.add('desktop-booted');
			var screen = root.document.querySelector('#desktop-boot-screen');
			if (screen) screen.hidden = true;
		}
	};
})(window);
