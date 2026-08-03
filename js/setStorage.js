(function(root, factory) {
	var api = factory();
	if (typeof module === 'object' && module.exports) module.exports = api;
	if (root) root.CardConjurerSetStorage = api;
})(typeof window !== 'undefined' ? window : globalThis, function() {
	'use strict';
	var DB_NAME = 'card-conjurer';
	var DB_VERSION = 1;
	var connection = null;

	function requestPromise(request) {
		return new Promise(function(resolve, reject) {
			request.onsuccess = function() { resolve(request.result); };
			request.onerror = function() { reject(request.error || new Error('The local database request failed.')); };
		});
	}

	function transactionPromise(transaction) {
		return new Promise(function(resolve, reject) {
			transaction.oncomplete = function() { resolve(); };
			transaction.onabort = transaction.onerror = function() { reject(transaction.error || new Error('The local database transaction failed.')); };
		});
	}

	function open() {
		if (connection) return Promise.resolve(connection);
		if (typeof indexedDB === 'undefined') return Promise.reject(new Error('IndexedDB is not available in this browser.'));
		return new Promise(function(resolve, reject) {
			var request = indexedDB.open(DB_NAME, DB_VERSION);
			request.onupgradeneeded = function() {
				var db = request.result;
				if (!db.objectStoreNames.contains('sets')) db.createObjectStore('sets', {keyPath: 'id'});
				if (!db.objectStoreNames.contains('cards')) {
					var cards = db.createObjectStore('cards', {keyPath: 'id'});
					cards.createIndex('setId', 'setId', {unique: false});
				}
				if (!db.objectStoreNames.contains('history')) db.createObjectStore('history', {keyPath: 'setId'});
				if (!db.objectStoreNames.contains('preferences')) db.createObjectStore('preferences', {keyPath: 'key'});
				if (!db.objectStoreNames.contains('assets')) db.createObjectStore('assets', {keyPath: 'id'});
			};
			request.onblocked = function() { reject(new Error('Close other Card Conjurer tabs, then retry local storage.')); };
			request.onerror = function() { reject(request.error || new Error('Card Conjurer could not open local storage.')); };
			request.onsuccess = function() {
				connection = request.result;
				connection.onversionchange = function() { connection.close(); connection = null; };
				resolve(connection);
			};
		});
	}

	async function getAll(storeName) {
		var db = await open();
		return requestPromise(db.transaction(storeName, 'readonly').objectStore(storeName).getAll());
	}

	async function loadState() {
		var db = await open();
		var transaction = db.transaction(['sets', 'cards', 'history', 'preferences'], 'readonly');
		var setsRequest = transaction.objectStore('sets').getAll();
		var cardsRequest = transaction.objectStore('cards').getAll();
		var historyRequest = transaction.objectStore('history').getAll();
		var activeRequest = transaction.objectStore('preferences').get('active');
		var values = await Promise.all([requestPromise(setsRequest), requestPromise(cardsRequest), requestPromise(historyRequest), requestPromise(activeRequest)]);
		return {
			sets: values[0] || [], cards: values[1] || [],
			histories: Object.fromEntries((values[2] || []).map(function(item) { return [item.setId, item.history]; })),
			activeSetId: values[3] && values[3].activeSetId || null,
			revision: values[3] && values[3].revision || 0
		};
	}

	async function saveState(state) {
		var db = await open();
		var transaction = db.transaction(['sets', 'cards', 'history', 'preferences'], 'readwrite');
		var setStore = transaction.objectStore('sets');
		var cardStore = transaction.objectStore('cards');
		var historyStore = transaction.objectStore('history');
		setStore.clear(); cardStore.clear(); historyStore.clear();
		(state.sets || []).forEach(function(set) { setStore.put(set); });
		(state.cards || []).forEach(function(card) { cardStore.put(card); });
		Object.keys(state.histories || {}).forEach(function(setId) { historyStore.put({setId: setId, history: state.histories[setId]}); });
		transaction.objectStore('preferences').put({key: 'active', activeSetId: state.activeSetId, revision: state.revision || Date.now(), schemaVersion: DB_VERSION});
		await transactionPromise(transaction);
		return state;
	}

	async function deleteDatabaseForTests() {
		if (connection) { connection.close(); connection = null; }
		return new Promise(function(resolve, reject) {
			var request = indexedDB.deleteDatabase(DB_NAME);
			request.onsuccess = function() { resolve(); };
			request.onerror = function() { reject(request.error); };
			request.onblocked = function() { reject(new Error('The database is open in another tab.')); };
		});
	}

	return {
		DB_NAME: DB_NAME, DB_VERSION: DB_VERSION,
		open: open, getAll: getAll, loadState: loadState, saveState: saveState,
		deleteDatabaseForTests: deleteDatabaseForTests
	};
});
