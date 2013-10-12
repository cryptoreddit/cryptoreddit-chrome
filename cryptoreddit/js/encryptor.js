var PRIVATE_KEYS = {};
var PUBLIC_KEYS = {};
var othersKeys;
var yourKeys;
var userGroups;

// Load stuff from memory, one by one
getUserGroups();
function getUserGroups() {
	chrome.storage.local.get('userGroups', function(w) {
		if (w.userGroups && w.userGroups.length) {
			userGroups = w.userGroups;
		} else {
			userGroups = [];
		}
	});
}

getYourKeys();
function getYourKeys() {
	chrome.storage.local.get('yourKeys', function(x) {
		if (x.yourKeys && x.yourKeys.length) {
			yourKeys = x.yourKeys;
		} else {
			yourKeys = [];
		}

		_.each(yourKeys, function(key) {
			PRIVATE_KEYS[key.username] = {
				privateKey: key.privateKeytext, 
				publicKey: key.publicKeytext
			};
			try {
				var k = openpgp.read_publicKey(key.publicKeytext);
				PUBLIC_KEYS[key.username] = k;
			} catch(error) {
				console.log("Could not import invalid key for /u/" + key.username);
			}
		});
		/*if (PUBLIC_KEYS[slashSubreddit]) {
			subredditIsEncryptable = true;
		}*/
	});
	
}

getOthersKeys();
function getOthersKeys() {
	chrome.storage.local.get('othersKeys', function(y) {
		if (y.othersKeys && y.othersKeys.length) {
			othersKeys = y.othersKeys;
		} else {
			othersKeys = [];
		}

		function importKey(key) {
			try {
				var k = openpgp.read_publicKey(key.keytext);
				PUBLIC_KEYS[key.username] = k;
			} catch(error) {
				console.log("Could not import invalid key for /u/" + key.username);
			}
		}

		_.each(othersKeys, importKey);

	});
}









// Create IE + others compatible event handler
var eventMethod = window.addEventListener ? "addEventListener" : "attachEvent";
var eventer = window[eventMethod];
var messageEvent = eventMethod == "attachEvent" ? "onmessage" : "message";
// Listen to message from child window
eventer(messageEvent,function(e) {
	//console.log("GOT MESSAGE1:", e);

	var ciphertext = getCiphertext(e.data.myself, e.data.author, e.data.groupSelection);
	if (!ciphertext) {
		alert("Could not encrypt. One or more of the selected keys may be invalid.");
	} else {
		window.parent.postMessage({
	    	ciphertext: ciphertext,
	    	src: window.location.href
	    }, "http://www.reddit.com");
	}
},false);

function getCiphertext(myself, author, groupSelection) {
	console.log("GO!!!!", myself, author, groupSelection);
	//TODO: If there's a server-side error, restore the plaintext.
	var plaintext = $("textarea").val();

	var keys = [];
	
	//If we're encrypting to a group, add all the keys for that group.
	//If we're encrypting to a subreddit, add that subreddit's key.
	var isToSubreddit = false;
	if (groupSelection) {
		if (groupSelection.charAt(0)==="/") {
			keys.push(PUBLIC_KEYS[groupSelection]);
			isToSubreddit = true;
		} else {
			var toGroup;
			for (var i=0; i<userGroups.length; i++) {
				if (userGroups[i].name === groupSelection) {
					toGroup = userGroups[i];
					break;
				}
			}
			for (var i=0; i<toGroup.members.length; i++) {
				var memberKey = PUBLIC_KEYS[toGroup.members[i]];
				if (memberKey && keys.indexOf(memberKey) === -1) {
					keys.push(memberKey);
				}
			}												
		}
	} else {
		keys.push(PUBLIC_KEYS[author]);
	}
	//Lastly, add the user's own key, if it hasn't already been added,
	//and if we're not encrypting to the whole subreddit.
	if (!isToSubreddit) {
		if (true||PUBLIC_KEYS[myself]) { //Check for this before making request
			if (keys.indexOf(PUBLIC_KEYS[myself]) === -1) {
				keys.push(PUBLIC_KEYS[myself]);
			}
		} else {
			if (!confirm("You won't be able to read this message later because you don't have a keypair loaded for /u/"+author+". Continue?")) {
				return false;
			}
		}
	}
	var encryption = encrypt(plaintext, keys);
	if (encryption) {
		//console.log("CIPHERTEXT:", encryption);
		return encryption;
	} else {
		console.log("COULD NOT ENCRYPT");
		return false;
	}
}