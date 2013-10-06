openpgp.init();


function rewriteComment(message, shorten, sr) {
	var versionNumber = "";
	if (typeof ( chrome.runtime.getManifest ) == 'function') {
		versionNumber = chrome.runtime.getManifest().version;
	}
	message = message.replace("Comment: http://openpgpjs.org", "Comment: /r" + (sr || "/cryptoreddit"));
	message = message.replace("Version: OpenPGP.js v.1.20130712","Version: CryptoReddit "+versionNumber);
	//Conceal overly long messages:
	if (shorten && message.length > 1000) {
		message = message.replace(/\r/g,"")
			.replace(/\n/g,"_")
			.replace("__","[](//#__")
			.replace("-----END",")-----END")
			.replace("END PGP MESSAGE-----_","END PGP MESSAGE-----");
	}
	if (message.length > 10000) {
		alert("Warning: Message is too long to post in a reddit comment!");
	}
	return message;
}



function encrypt(messageText, listOfPublicKeys, dontShorten) {
  var shorten = !dontShorten;
  if (window.crypto.getRandomValues) {
  	try {
	    openpgp.init();
	    var pub_key = listOfPublicKeys[0];
	    for (var i=1; i<listOfPublicKeys.length; i++) {
	    	pub_key[i] = listOfPublicKeys[i][0];
	    }
	    var result = openpgp.write_encrypted_message(pub_key,messageText);
	    result = rewriteComment(result, shorten);
	    return result;
	} catch(error) {
		console.log(error);
		alert("Could not encrypt; one or more of the encryption keys may be invalid.");
		return false;
	}
  } else {
  	alert("Could not encrypt; your browser is not supported.");
    return false; 
  }
}



function addPublicKeyForUser(username, keytext, callback) {
	var id = -1;
	_.each(othersKeys, function(key){
		if (id < key.id) {
			id = key.id;
		}
	});
	id++;
	var entry = {
		username: username,
		keytext: keytext,
		timestamp: new Date().getTime(),
		source: "",
		id: id
	};
	othersKeys.push(entry);
	chrome.storage.local.set({'othersKeys': othersKeys}, callback);
}