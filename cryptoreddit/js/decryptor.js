var yourKeys, messageCache;

var parser = SnuOwnd.getParser();
openpgp.init();

$(document).ready(function() {
	getYourKeys();
});


function getYourKeys() {
	chrome.storage.local.get('yourKeys', function(x) {
		if (x.yourKeys && x.yourKeys.length) {
			yourKeys = x.yourKeys;
		} else {
			yourKeys = [];
		}
		//console.log("yk", yourKeys);
		getMessageCache();
	});

	
}

function getMessageCache() {
	chrome.storage.local.get('messageCache', function(z) {
		if (z.messageCache) {
			messageCache = z.messageCache;
		} else {
			messageCache = {};
		}
		//TODO: Remove messages that haven't been accessed in a certain amount of time.
		mainFunction();
	});
}

function mainFunction() {
	var selfUrl = window.location.href;
	var hashKey = selfUrl.slice(selfUrl.indexOf("?m=")+3);
	//console.log(hashKey);

	var cachedMessage = messageCache[hashKey];
	var hoverText, contentText, elementClass;

	if (cachedMessage) {
		hoverText = cachedMessage.recipientsString;
		if (cachedMessage.plaintext) {
			contentText = parser.render(cachedMessage.plaintext);
			elementClass = "encrypted";
		} else {
			contentText = cachedMessage.ciphertext;
			elementClass = "undecryptable";
		}
	} else {
		hoverText = "(unknown)";
		contentText = "Memory failure: "+hashKey;
		elementClass = "undecryptable";
	}


	$("body").html("<div class='md "+elementClass+"' title='"+hoverText+"'>"+contentText+"</div>");

	if ($("body").text().indexOf("-----BEGIN PGP PRIVATE KEY BLOCK-----") !== -1) {
		distinguishPrivateKeyElements();
	}


	//$("a").attr("target","_blank");
	$("a[href^='/']").each(function(){
		$(this).attr("href", "http://www.reddit.com"+$(this).attr("href"));
	});

	//window.parent.location.href="http://www.google.com";

	//var frame = $(window.frameElement);
	//var frame = $("iframe[src='"+window.location.href+"']", window.parent);
    //var height = $("div").first().height();
    //frame.height(height + 15);
    window.parent.postMessage({
    	height: $("div").first().height(),
    	src: window.location.href
    }, "http://www.reddit.com");

}


function distinguishPrivateKeyElements() {
	var element = $("body");
	var wholeHtml = element.html();
	var keytexts = [];
	var fromIndex = 0;
	while (fromIndex < wholeHtml.length) {
		var beginIndex = wholeHtml.indexOf("-----BEGIN PGP PRIVATE KEY BLOCK-----", fromIndex);
		var endIndex = wholeHtml.indexOf("-----END PGP PRIVATE KEY BLOCK-----", fromIndex);
		if (beginIndex === -1 || endIndex === -1) {
			break;
		} else {
			fromIndex = endIndex+35;
			var keytext = wholeHtml.substring(beginIndex, fromIndex);
			keytexts.push(keytext);
		}
	}
	for (var j=0; j<keytexts.length; j++) {
		var keytext = keytexts[j];
	    try {
	    	var strippedKeytext = keytext.replace(/<p>/g,"");
			openpgp.read_privateKey(strippedKeytext);
			wholeHtml = wholeHtml.replace(keytext, "<div class='newprivatekey'>"+keytext+"</div>")
		} catch(error) {
			console.log("couldn't read", keytext, error);
			return;
		}
	}
	element.html(wholeHtml);
	element.find(".newprivatekey").each(function(){
		var et = $(this).text();
		var start = et.indexOf("Comment: ");
		var end = start+et.slice(start).indexOf("\n");
		var subredditName = et.slice(start,end).slice(9);
		var sr;
		if (subredditName.indexOf("/r/")===0) {
			sr = subredditName.slice(2);
		}
		if (sr) {
			var alreadyHaveIt = false;
			for (var i=0; i<yourKeys.length; i++) {
				if (yourKeys[i].username === sr) {
					alreadyHaveIt = true;
					break;
				}
			}
			if (!alreadyHaveIt) {
				var ell = $(this);
				ell.css('color','lime');
		    	ell.css('cursor','pointer');
				ell.on('click', function(){
					if (confirm("Import this private key for /r" + sr + "?")) {
						//TODO: read key now.
						var strippedKeytext = ell.text().replace(/<p>/g,"");
						addPrivateKey(strippedKeytext, sr, (function() {
							//var el = $(this);
							return function(){
								undistinguishPublicKeyElement(ell);
							}
						})());
					}
				});
			}
		}

	});
}


function addPrivateKey(privateKeytext, name, callback) {
	try {
		var fullKey = openpgp.read_privateKey(privateKeytext)[0];
		var publicKeytext = fullKey.extractPublicKey();
		publicKeytext = rewriteComment(publicKeytext);

		//or something like that
		var timestamp = new Date().getTime();
		var source = "";
		var id=-1;
		for (var i=0; i<yourKeys.length; i++) {
			if (id < yourKeys[i].id) {
				id = yourKeys[i].id;
			}
		}
		id = id+1;
		var entry = {
			username:name,
			publicKeytext:publicKeytext,
			privateKeytext:privateKeytext,
			timestamp:timestamp,
			source:source,
			id:id
		};
		yourKeys.push(entry);
		chrome.storage.local.set({'yourKeys': yourKeys}, callback);
	} catch(error) {
		console.log("IMPORT PRIVATE KEY ERROR:", error);
		alert("Could not import invalid key for /r" + name);
	}
}




function undistinguishPublicKeyElement(element) {
	alert("Key imported! Reload to start sending encrypted messages to this user or subreddit.");
	//console.log(element);
	element.css('color','inherit');
	element.css('cursor','inherit');
	element.unbind('click');
	//TODO: distinguish this user as encryptable.
}



