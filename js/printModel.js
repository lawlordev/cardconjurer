(function(root, factory) {
	var api = factory();
	if (typeof module === 'object' && module.exports) module.exports = api;
	if (root) root.SetConjurerPrint = api;
})(typeof window !== 'undefined' ? window : globalThis, function() {
	'use strict';
	var PAPERS = {
		letter: {label: 'US Letter', widthIn: 11, heightIn: 8.5},
		a4: {label: 'A4', widthIn: 11.6929, heightIn: 8.2677}
	};
	function quantity(value) { return Math.max(0, Math.min(99, Math.round(Number(value) || 0))); }
	function expand(cards) {
		return (cards || []).flatMap(function(card) { return Array.from({length: quantity(card.printQuantity == null ? 1 : card.printQuantity)}, function() { return card; }); });
	}
	function pages(cards) {
		var copies = expand(cards); var result = [];
		for (var index = 0; index < copies.length; index += 8) result.push(copies.slice(index, index + 8));
		return result.length ? result : [[]];
	}
	function backSlots(cards) {
		var slots = (cards || []).slice(0, 8);
		while (slots.length < 8) slots.push(null);
		return slots.slice(0, 4).reverse().concat(slots.slice(4, 8).reverse());
	}
	return {PAPERS: PAPERS, quantity: quantity, expand: expand, pages: pages, backSlots: backSlots};
});
