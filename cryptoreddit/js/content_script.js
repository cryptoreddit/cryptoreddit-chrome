var PRIVATE_KEYS = {}, PUBLIC_KEYS = {},
    othersKeys, yourKeys, userGroups, messageCache,
    subredditIsEncryptable = false,
    topFormIsEncryptable = false,
    slashSubreddit = "/"+window.location.pathname.split("/")[2],
    postingAs = $(".user").first().children().first().text(),
    resIsEnabled = !!$("#RESConsole").length;

// Load stuff from memory, one by one
getUserGroups();
function getUserGroups() {
	chrome.storage.local.get('userGroups', function(w) {
		if (w.userGroups && w.userGroups.length) {
			userGroups = w.userGroups;
		} else {
			userGroups = [];
		}
		getYourKeys();
	});
}

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
		if (PUBLIC_KEYS[slashSubreddit]) {
			subredditIsEncryptable = true;
		}
	});
	getOthersKeys();
}

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
		getMessageCache();
	});
}


function getMessageCache() {
	chrome.storage.local.get('messageCache', function(z) {
		if (z.messageCache && Object.keys(z.messageCache).length) {
			messageCache = z.messageCache;
		} else {
			messageCache = {"-1": 1440};
		}
		// Uncache messages that haven't been accessed in a certain amount of time.
		var currentTime = (new Date()).getTime();
		var cacheTimeMilliseconds = messageCache[-1]*60*1000;
		for (var hashKey in messageCache) {
			if (parseInt(hashKey) >= 0 && 
				currentTime - messageCache[hashKey].lastAccessed > cacheTimeMilliseconds
			) {
				delete messageCache[hashKey];
			}
		}
		mainFunction();
	});
}

function hashCode(s) {
    return Math.abs(s.split("").reduce(function(a,b){a=((a<<5)-a)+b.charCodeAt(0);return a&a},0));              
}


function decrypt(messageText, privateKey) {
  if (window.crypto.getRandomValues) {
    var priv_key = openpgp.read_privateKey(privateKey);
    var msg;
    var recipientNames = [];
    try {
    	msg = openpgp.read_message(messageText);
    	_.each(msg[0].sessionKeys, function(sessionKey){
	    	for (var un in PUBLIC_KEYS) {
	    		var pkid = PUBLIC_KEYS[un][0].getKeyId();
	    		if (sessionKey.keyId.bytes === pkid) {
	    			recipientNames.push(un);
	    			break;
	    		}
	    	}
    	});
    } catch (error) {
    	return [false, []];
    }

    while (recipientNames.length < msg[0].sessionKeys.length) {
    	recipientNames.push("+");
    }

	var keymat = { key: priv_key[0], keymaterial: priv_key[0].privateKeyPacket};
    var sesskey = _.find(msg[0].sessionKeys, function(sesskey){
    	return priv_key[0].privateKeyPacket.publicKey.getKeyId() == sesskey.keyId.bytes;
    });

    if (sesskey) {
	    var subkey = _.find(priv_key[0].subKeys, function(privSubkey){
	    	return privSubkey.publicKey.getKeyId() == sesskey.keyId.bytes;
	    });
	    if (subkey){
	    	keymat = { key: priv_key[0], keymaterial: subkey};
	    }
    }

    if (keymat) {
      	try {
      		return [msg[0].decrypt(keymat, sesskey), recipientNames];
      	} catch(error) {
      		return [false, recipientNames];
      	}
    } else {
      return [false, recipientNames];
    }
  } else {
    console.log("Browser unsupported!");
    return [false, []]; 
  }
}


function attemptToDecrypt(ciphertext, callback) {
	var hashKey = hashCode(ciphertext);
	if (messageCache[hashKey] && messageCache[hashKey].plaintext) {
		console.log("Cache hit");
		messageCache[hashKey].lastAccessed = (new Date()).getTime();
		chrome.storage.local.set({'messageCache': messageCache});
		callback();
	} else {
		console.log("Cache miss");
		var plaintext = false, recipients = "(unknown)";
		_.find(Object.keys(PRIVATE_KEYS), function(privateKeyUsername){
			var res = decrypt(ciphertext, PRIVATE_KEYS[privateKeyUsername].privateKey);
			plaintext  = res[0];
			recipients = res[1];
			return !!plaintext;
		});
		var recipientsString = analyzeRecipients(recipients);
		messageCache[hashKey] = {
			ciphertext: ciphertext,
			plaintext: plaintext,
			lastAccessed: (new Date()).getTime(),
			recipientsString: recipientsString
		}
		chrome.storage.local.set({'messageCache': messageCache}, callback);
	}
}



// Given a list of usernames, find the most concise representation
// in terms of the groups that we have defined.
function analyzeRecipients(recipientNames) {
	// How many "+" are there?
	var extras = _.filter(recipientNames, function(recipientName) {
		return recipientName === "+";
	}).length;

	// Make a candidate analysis for each group.
	var candidates = _.map(userGroups, function(group){
		// List all recipients who are NOT in this group,
		var inclusions = _.filter(recipientNames, function(recipient){
			return (recipient !== "+" && group.members.indexOf(recipient) === -1);
		});
		// List all group members who are NOT recipients
		var exclusions = _.filter(group.members, function(groupMember){
			return (recipientNames.indexOf(groupMember) === -1);
		});
		exclusions = _.map(exclusions, function(excludedName){
			return "!"+excludedName;
		});
		var candidate = ["@"+group.name].concat(inclusions).concat(exclusions);
		return candidate;
	});

	// Groupless candidate: Simply list all recipients' names.
	var grouplessCandidate = _.filter(recipientNames, function(recipientName) {
		return recipientName !== "+";
	});
	candidates.push(grouplessCandidate);

	// Find the most concise (i.e. shortest) candidate.
	var bestCandidate = _.min(candidates, function(candidate){
		return candidate.length;
	});
	return bestCandidate.join(" ") + (extras ? " +"+extras : "");
}



// Go through html, and return a list of elements
// that begin with "beginner" and end with "ender".
function findMarkedBlocks(html, beginner, ender) {
	var foundBlocks = [];
	var fromIndex = 0;
	while (fromIndex < html.length) {
		var beginIndex = html.indexOf(beginner, fromIndex);
		var endIndex = html.indexOf(ender, fromIndex);
		if (beginIndex === -1 || endIndex === -1) {
			break;
		} else {
			fromIndex = endIndex+ender.length;
			var found = html.substring(beginIndex, fromIndex);
			foundBlocks.push(found);
		}
	}
	return foundBlocks;
}


function decryptElement(element) {
	var wholeHtml = element.html();
	var ciphertexts = findMarkedBlocks(wholeHtml, "-----BEGIN PGP MESSAGE-----", "-----END PGP MESSAGE-----");
	// Replace them one by one with iframes, and tell each iframe to decrypt the message.
	_.each(ciphertexts, function(ciphertext){
		var originalCiphertext = ciphertext;
		if (ciphertext.indexOf("//#__") !== -1) {
			ciphertext = ciphertext.replace(/_/g,"\n");
		} // Parse "hidden ciphertext" format
		// Remove extraneous line breaks (caused by old OpenPGPJS bug)
		ciphertext = ciphertext.replace("\n\n","_").replace(/\n\n/g, "\n").replace("_","\n\n").replace(/<p>/g,"");
		attemptToDecrypt(ciphertext, function() {
			var iframeSrc = "chrome-extension://"+chrome.runtime.id+"/decryptor.html?m="+hashCode(ciphertext);
			// Remove RES alterations from ciphertext HTML
			var dehancedHtml = element.html().replace(/ class="imgScanned"/g,'');
			if (dehancedHtml.indexOf(originalCiphertext) ===-1) {
				console.log("Could not find:", originalCiphertext, "in:", dehancedHtml);
			}
			element.html(dehancedHtml.replace(originalCiphertext,
				"<iframe scrolling='no' frameborder='0' style='"+
				"overflow:hidden;"+
				"border:none;"+
				"width:100%; height:10px"+
				"' src='"+iframeSrc+"'></iframe>"
			));
		});
	});
}


function distinguishPublicKeyElement(element) {
	var username = element.closest(".entry").find(".author").first().text();
	if (!PUBLIC_KEYS[username]) {
		var wholeHtml = element.html();
		var keytexts = findMarkedBlocks(wholeHtml, "-----BEGIN PGP PUBLIC KEY BLOCK-----","-----END PGP PUBLIC KEY BLOCK-----");
		_.each(keytexts, function(keytext){
		    try {
		    	var strippedKeytext = keytext.replace(/<p>/g,"");
				openpgp.read_publicKey(strippedKeytext);
				wholeHtml = wholeHtml.replace(keytext, "<div class='newpublickey'>"+keytext+"</div>")
			} catch(error) {
				console.log("couldn't read", keytext, error);
				//return;
			}
		});
		element.html(wholeHtml);
		element.find(".newpublickey").each(function(){
			$(this).css('color','magenta');
	    	$(this).css('cursor','pointer');
	    	var that = $(this);
			$(this).on('click', function(){
				//console.log("CLICKED!!!!");
    			if (confirm("Import this key for user " + username + "?")) {
    				var strippedKeytext = element.text().replace(/<p>/g,"");
    				PUBLIC_KEYS[username] = strippedKeytext;
    				addPublicKeyForUser(username, strippedKeytext, (function() {
    					var el = that;
    					return function(){
    						undistinguishPublicKeyElement(el);
    					};
    				})());
    			}
    		});
		});
	}
}




function undistinguishPublicKeyElement(element) {
	alert("Key imported! Reload to start sending encrypted messages to this user or subreddit.");
	element.css('color','inherit');
	element.css('cursor','inherit');
	element.unbind('click');
	//TODO: distinguish this user as encryptable.
}



function addEncryptionOptions(form, author, modmailSubreddit) {
	if (!modmailSubreddit) {
		modmailSubreddit = "";
	}
	var sr = false;
	if (subredditIsEncryptable) {
		sr = slashSubreddit;
	} else if (modmailSubreddit !== "") {
		sr = modmailSubreddit.slice(2);
	}

	var cancelB = form.find('.cancel').first();
	var ta = form.find('textarea').first();

	var iframeSrc = "chrome-extension://"+chrome.runtime.id+"/encryptor.html?i="+(Math.floor(Math.random()*1000000000));
	var ifr = $(
		"<iframe scrolling='no' frameborder='0' style='"+
		"overflow:hidden;"+
		"border:none;"+
		"width:505px; height:106px"+
		"' src='"+iframeSrc+"'></iframe>"
	).insertAfter(ta);
	ta.css("display","none");

	var eb = $('<span class="encryptbox"><input type="checkbox" checked="checked" />encrypt </span>').insertAfter(cancelB);

	var inGroups = _.filter(userGroups, function(group){
		return group.members.indexOf(author) !== -1;
	});

	var groupsMenu = $('<select class="encryptselector">'+
		(sr&&PUBLIC_KEYS[sr] ? '<option value="'+sr+'">/r'+sr+'</option>' : '')+
		(PUBLIC_KEYS[author] ? '<option value="">to us only</option>' : '')+
		_.map(inGroups, function(group){
			return '<option value="'+group.name+'"">@'+group.name+'</option>';
		}).join("")+
		'</select>').insertAfter(eb);
	groupsMenu.css("width", resIsEnabled ? "100px" : "120px");
	eb.on('change', function(){
		if (ta.css("display")==="none") {
			if (groupsMenu) {
				groupsMenu.attr("disabled","disabled");
			}
			ta.css("display","block");
			ifr.css("display","none")
		} else {
			if (groupsMenu) {
				groupsMenu.attr("disabled",null);
			}
			ta.css("display","none");
			ifr.css("display","block")
		}
	});
	var sb = form.find('.save').first();
	sb.on('click', function(){
		var checkbox = $(this).closest('div').find('input').first();
		if (checkbox.attr('checked')==='checked') {
			var iframeWin = ifr[0].contentWindow;
			var groupSelection = groupsMenu ? groupsMenu.val() : "";
			iframeWin.postMessage({
				groupSelection: groupSelection,
				author: author,
				myself: postingAs
			}, "chrome-extension://"+chrome.runtime.id);
			//console.log("Requested ciphertext");
			return false;
		} else {
			var plaintext = ta.val();
			if (plaintext.indexOf("-----BEGIN PGP PRIVATE KEY BLOCK-----") !== -1 && plaintext.indexOf("-----END PGP PRIVATE KEY BLOCK-----") !== -1) {
				alert("It looks like you're trying to post a private key in an unencrypted message. "+
					"This would irrevocably spoil the key for everyone who's using it. "+
					"Please encrypt it before sending.");
				return false;
			}
			listenForNewThing();
			return true;
		}
	});
}


function removeEncryptionOptions(form) {
	form.find(".encryptbox").remove();
	form.find(".encryptselector").remove();
	var ta = form.find('textarea').first();
	ta.css('display','block');
	form.find("iframe").remove();
	var sb = form.find('.save').first();
	sb.on('click', null);
}


function offerEncryptionIfPossible(superElement) {
	var modmailSubreddit = 
		superElement.closest(".message-parent")
		.find("span.correspondent.reddit")
		.find("a").first().text();
	var modmailIsEncryptable = !!PUBLIC_KEYS[modmailSubreddit.slice(2)];

	var authorElement = superElement.find(".author").first();
	var author = authorElement.text() || postingAs;
	var authorIsEncryptable = !!PUBLIC_KEYS[author];

	if (authorIsEncryptable) {
		authorElement.css("background-color","black").css("color","yellow").css("padding","3px");
		authorElement.addClass("encryptable");
	}
	if (authorIsEncryptable || modmailIsEncryptable || subredditIsEncryptable) {
		var rrb = superElement.closest(".noncollapsed").find(".buttons").find("a:contains('reply')").first();
		//I think that actually still works.
		if (rrb.length === 1) {				
			rrb.on('click',function() {
				//console.log("clicked reply");
				if (!$(this).attr('alreadyclicked')) {
					$(this).attr("alreadyclicked","yes");
					var thing = $(this).closest('.thing');
					var form = thing.find(".cloneable").first();
					if (topFormIsEncryptable) {
						removeEncryptionOptions(form);
					}
					addEncryptionOptions(form, author, modmailSubreddit);
					// If the author themself isn't encryptable, don't check the box by default.
					if (!authorIsEncryptable) {
						form.find('.save').first().closest('div').find('input').first().click();
					}
				}
			});
		}
	}
}


// Wait for a new thing to appear, and then apply transformations to it.
function listenForNewThing() {
	var thingsOnPage = $(".sitetable").find(".thing");
	var numberOfThings = thingsOnPage.length;
	var newThingListener = setInterval((function(){
		return function(){
			console.log("Checking for new thing");
			var thingsNowOnPage = $(".sitetable").find(".thing");
			if (thingsNowOnPage.length > numberOfThings) {
				console.log("New thing detected!");
				clearInterval(newThingListener);
				thingsNowOnPage.each(function(){
					thisThingClassSelector = ("."+$(this).attr("class").replace(/ /g, ".")).replace("..",".");
					thisThingClassSelector = thisThingClassSelector.slice(0, thisThingClassSelector.length-1);
					// Is this thing a new one?
					if (thingsOnPage.filter(thisThingClassSelector).length === 0) {
						var newElement = $(thisThingClassSelector).find(".noncollapsed");
						if (newElement.length === 0) {
							return;
						}
						console.log("##", thisThingClassSelector);
						var npt = newElement.closest('.thing').parent().closest('.thing');
						npt.find("a[alreadyclicked='yes']").attr("alreadyclicked",null);
						decryptElement(newElement.find("div.md"));
						offerEncryptionIfPossible(newElement);
					}
				});	
			}
		};
	})(), 100);
}





var mainFunction = function() {

	//If possible, mark the top-level form as encryptable.
	var topCommentForm = $("form.cloneable").first();
	if (topCommentForm.length > 0 && topCommentForm.attr('id').indexOf('form-')===0) {
		var author = $(".link").find(".tagline").find(".author").text();
		if (PUBLIC_KEYS[author] || subredditIsEncryptable) {
			addEncryptionOptions(topCommentForm, author);
			topFormIsEncryptable = true;
		}
	}
	
    //Add options to encrypt messages to people whose keys we know,
    //and to other forms, if we at least have a subreddit key.

	$(".tagline").each(function(){
		offerEncryptionIfPossible($(this));
	});

	//Distinguish encryptable subreddits in modmail
	$("span.correspondent.reddit").each(function(){
		var subredditLink = $(this).find("a").first();
		var subredditName = subredditLink.text();
		var slicedName = subredditName.slice(2);
		if(PUBLIC_KEYS[slicedName]){
			$(this).css("background-color","black");
			subredditLink.css("color","yellow");
		}
	});

	//Decrypt encrypted blocks, and highlight public keys for import.
    $('div.md').each(function(){
    	if ( $(this).text().indexOf("-----BEGIN PGP MESSAGE-----") !== -1 ) {
    		decryptElement($(this));
    	}
    	if ($(this).text().indexOf("-----BEGIN PGP PUBLIC KEY BLOCK-----") !== -1) {
    		distinguishPublicKeyElement($(this));
    	}
    });
}



// Listen for messages from iframes:
var eventMethod = window.addEventListener ? "addEventListener" : "attachEvent";
var eventer = window[eventMethod];
var messageEvent = eventMethod === "attachEvent" ? "onmessage" : "message";
eventer(messageEvent,function(e) {
	var eventOriginator = $("iframe[src='"+e.data.src+"']");
	
	// Received "resize height" message. Adjust the height of the iframe to match its contents.
	if (e.data.height) {
		eventOriginator.height(e.data.height+15);
	}

	// Received "ciphertext" message. Post the ciphertext to Reddit.
	if (typeof e.data.ciphertext !== "undefined") {
		eventOriginator.prev("textarea").val(e.data.ciphertext).css("display","block");
		eventOriginator.css("display","none");
		var form = eventOriginator.closest("form");
		var eb = form.find(".encryptbox input");
		var sb = form.find('.save').first();
		var gm = form.find(".encryptselector");
		gm.attr("disabled","disabled");
		eb.attr('checked',null);
		sb.unbind('click').click();

		// Listen for the new thing to appear, and apply transformations to it.
		listenForNewThing();
	}
}, false);
