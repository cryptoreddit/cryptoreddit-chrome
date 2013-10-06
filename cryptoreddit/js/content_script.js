var PRIVATE_KEYS = {};
var PUBLIC_KEYS = {};
var othersKeys;
var yourKeys;
var userGroups;

var parser = SnuOwnd.getParser();

var slashSubreddit = "/"+window.location.pathname.split("/")[2];
var subredditIsEncryptable = false;

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

		mainFunction();
	});
}




function decrypt(messageText, privateKey) {
  if (window.crypto.getRandomValues) {
    var priv_key = openpgp.read_privateKey(privateKey);
    var msg;
    var recipientNames = [];
    try {
    	msg = openpgp.read_message(messageText);
	    for (var i=0; i<msg[0].sessionKeys.length; i++) {
	    	var keyId = msg[0].sessionKeys[i].keyId.bytes;
	    	for (var un in PUBLIC_KEYS) {
	    		if (PUBLIC_KEYS.hasOwnProperty(un)) {
		    		var pkid = PUBLIC_KEYS[un][0].getKeyId();
		    		if (keyId === pkid) {
		    			recipientNames.push(un);
		    			break;
		    		}
		    	}
	    	}
	    }
    } catch (error) {
    	return [false, []];
    }

    var keymat = null;
    var sesskey = null;



    while (recipientNames.length < msg[0].sessionKeys.length) {
    	recipientNames.push("+");
    }

    // Find the private (sub)key for the session key of the message
    for (var i = 0; i < msg[0].sessionKeys.length; i++) {
      if (priv_key[0].privateKeyPacket.publicKey.getKeyId() == msg[0].sessionKeys[i].keyId.bytes) {
        keymat = { key: priv_key[0], keymaterial: priv_key[0].privateKeyPacket};
        sesskey = msg[0].sessionKeys[i];
        break;
      }
      for (var j = 0; j < priv_key[0].subKeys.length; j++) {
        if (priv_key[0].subKeys[j].publicKey.getKeyId() == msg[0].sessionKeys[i].keyId.bytes) {
          keymat = { key: priv_key[0], keymaterial: priv_key[0].subKeys[j]};
          sesskey = msg[0].sessionKeys[i];
          break;
        }
      }
    }
    if (keymat != null) {
      /*if (!keymat.keymaterial.decryptSecretMPIs($('#decpassword').val())) {
        alert("Password for secret key was incorrect!");
        return;
      }*/
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


//Given a list of usernames, find the most concise representation
//in terms of the groups that we have defined.
function analyzeRecipients(recipientNames) {
	var candidates = [[]];
	var extras = 0;
	for (var i=0; i<recipientNames.length; i++) {
		if (recipientNames[i] === "+") {
			extras += 1;
		} else {
			candidates[0].push(recipientNames[i]);
		}
	}
	for (var i=0; i<userGroups.length; i++) {
		var group = userGroups[i];
		var candidate = ["@"+group.name];
		//For each recipient NOT in the group, add their name.
		for (var j=0; j<recipientNames.length; j++) {
			var un = recipientNames[j];
			if (un === "+") {
				break;
			} else {
				if (group.members.indexOf(un) === -1) {
					candidate.push(un);
				}
			}
		}
		//For each group member NOT a recipient, add an !exclusion.
		for (var j=0; j<group.members.length; j++) {
			var uun = group.members[j];
			if (recipientNames.indexOf(uun) === -1) {
				candidate.push("!"+uun);
			}
		}
		candidates.push(candidate);
		
	}
	var bestSoFar;
	for (var i=0; i<candidates.length; i++) {
		if (!bestSoFar || bestSoFar.length > candidates[i].length) {
			bestSoFar = candidates[i];
		}
	}
	return bestSoFar.join(" ") + (extras ? " +"+extras : "");
}



function decryptElement(element) {
	var wholeHtml = element.html();
	var ciphertexts = [];
	var fromIndex = 0;
	while (fromIndex < wholeHtml.length) {
		var beginIndex = wholeHtml.indexOf("-----BEGIN PGP MESSAGE-----", fromIndex);
		var endIndex = wholeHtml.indexOf("-----END PGP MESSAGE-----", fromIndex);
		if (beginIndex === -1 || endIndex === -1) {
			break;
		} else {
			fromIndex = endIndex+25;
			var ciphertext = wholeHtml.substring(beginIndex, fromIndex);
			ciphertexts.push(ciphertext);
		}
	}
	for (var j=0; j<ciphertexts.length; j++) {
		var ciphertext = ciphertexts[j];
		var originalCiphertext = ciphertexts[j];
		if (ciphertext.indexOf("//#__") !== -1) {
			ciphertext = ciphertext.replace(/_/g,"\n");
		} //Phase this out?
		//TODO: Find a more permanent fix for this. Might be a bug in openpgpjs, or with us.
		ciphertext = ciphertext.replace("\n\n","_").replace(/\n\n/g, "\n").replace("_","\n\n").replace(/<p>/g,"");
		var decryption;
		var recipientNames;
		var private_key_usernames = Object.keys(PRIVATE_KEYS);
		for (var i=0; i<private_key_usernames.length; i++) {
			var res = decrypt(ciphertext, PRIVATE_KEYS[private_key_usernames[i]].privateKey);
			decryption = res[0];
			recipientNames = res[1];
			if (decryption) {
				break;
			}
		}
		var hoverText = analyzeRecipients(recipientNames);
		if (decryption) {
			wholeHtml = wholeHtml.replace(originalCiphertext, "<div class='encrypted' title='"+hoverText+"'>"+parser.render(decryption)+"</div>")
		} else {
			wholeHtml = wholeHtml.replace(originalCiphertext, "<div class='undecryptable' title='"+hoverText+"'>"+ciphertext+"</div>")
		}
	}
	element.html(wholeHtml);
	element.find("pre").each(function(){
		if ($(this).find("code").find(".encrypted").length > 0) {
			var newHtml = $(this).html();
			var atIndex = 0;
			$(this).find("code").find(".encrypted").each(function(){
				var toh = $(this)[0].outerHTML;
				newHtml = newHtml.slice(0,atIndex) + newHtml.slice(atIndex).replace(toh, "</code></pre>"+toh+"<pre><code>");
				atIndex = atIndex + newHtml.slice(atIndex).indexOf(toh)+11;
			});
			$("<pre>"+newHtml+"</pre>").insertAfter($(this));
			$(this).remove();
		}
	});
	element.find(".encrypted").each(function(){
		$(this).css('color','white');
		$(this).css('background-color','black');
		$(this).css('padding','5px');
		$(this).css('margin','5px');
		$(this).find("a").css('color','#9cf');
	});
	element.find(".undecryptable").each(function(){
		$(this).css('color','lightgray');
		$(this).css('font-size','5pt');
	});
}


function distinguishPublicKeyElement(element) {
	var username = element.closest(".entry").find(".author").first().text();
	if (!PUBLIC_KEYS[username]) {
		var wholeHtml = element.html();
		var keytexts = [];
		var fromIndex = 0;
		while (fromIndex < wholeHtml.length) {
			var beginIndex = wholeHtml.indexOf("-----BEGIN PGP PUBLIC KEY BLOCK-----", fromIndex);
			var endIndex = wholeHtml.indexOf("-----END PGP PUBLIC KEY BLOCK-----", fromIndex);
			if (beginIndex === -1 || endIndex === -1) {
				break;
			} else {
				fromIndex = endIndex+34;
				var keytext = wholeHtml.substring(beginIndex, fromIndex);
				keytexts.push(keytext);
			}
		}
		for (var j=0; j<keytexts.length; j++) {
			var keytext = keytexts[j];
		    try {
		    	var strippedKeytext = keytext.replace(/<p>/g,"");
				openpgp.read_publicKey(strippedKeytext);
				wholeHtml = wholeHtml.replace(keytext, "<div class='newpublickey'>"+keytext+"</div>")

				/*
				element.addClass("newpublickey");
				element.css('color','magenta');
	    		element.css('cursor','pointer');
	    		element.on('click', function(){
	    			if (confirm("Import this key for user " + username + "?")) {
	    				//TODO: read key now.
	    				PUBLIC_KEYS[username] = element.text();
	    				addPublicKeyForUser(username, element.text(), (function() {
	    					var el = element;
	    					return function(){
	    						undistinguishPublicKeyElement(el);
	    					};
	    				})());
	    			}
	    		});*/
			} catch(error) {
				console.log("couldn't read", keytext, error);
				return;
			}


		}
		element.html(wholeHtml);
		element.find(".newpublickey").each(function(){
			$(this).css('color','magenta');
	    	$(this).css('cursor','pointer');


			$(this).on('click', function(){
    			if (confirm("Import this key for user " + username + "?")) {
    				//TODO: read key now.
    				var strippedKeytext = element.text().replace(/<p>/g,"");
    				PUBLIC_KEYS[username] = strippedKeytext;
    				addPublicKeyForUser(username, strippedKeytext, (function() {
    					var el = element;
    					return function(){
    						undistinguishPublicKeyElement(el);
    					};
    				})());
    			}
    		});
		});
	}
}


/*
function distinguishPublicKeyElement(element) {
	var username = element.closest(".entry").find(".author").first().text();
	if (!PUBLIC_KEYS[username]) {
	    try {
			openpgp.read_publicKey(element.text());
			element.addClass("newpublickey");
			element.css('color','magenta');
    		element.css('cursor','pointer');
    		element.on('click', function(){
    			if (confirm("Import this key for user " + username + "?")) {
    				//TODO: read key now.
    				PUBLIC_KEYS[username] = element.text();
    				addPublicKeyForUser(username, element.text(), (function() {
    					var el = element;
    					return function(){
    						undistinguishPublicKeyElement(el);
    					};
    				})());
    			}
    		});
		} catch(error) {
			console.log("couldn't read", element.text(), error);
			return;
		}
	}
}*/


function distinguishPrivateKeyElement(element) {
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
		if (sr && !PUBLIC_KEYS[sr]) {
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
					/*PUBLIC_KEYS[username] = strippedKeytext;
					addPublicKeyForUser(username, strippedKeytext, (function() {
						var el = element;
						return function(){
							undistinguishPublicKeyElement(el);
						};
					})());*/
				}
			});
		}

	});
}


function addPrivateKey(privateKeytext, name, callback) {
	try {
		var fullKey = openpgp.read_privateKey(privateKeytext)[0];
		var publicKeytext = fullKey.extractPublicKey();
		publicKeytext = rewriteComment(publicKeytext);
		PRIVATE_KEYS[name] = {
			privateKey: privateKeytext, 
			publicKey: publicKeytext
		};
		var k = openpgp.read_publicKey(publicKeytext);
		PUBLIC_KEYS[name] = k;
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
	//console.log("THE SUBREDDIT IS:", sr, "AND THE PUBLIC_KEYS:", PUBLIC_KEYS);
	var cancelB = form.find('.cancel').first();
	var ta = form.find('textarea').first();
	ta.addClass("encrypted");
	ta.css('background-color','black').css('color','white');
	var eb = $('<span class="encryptbox"><input type="checkbox" checked="checked" />encrypt </span>').insertAfter(cancelB);

	var inGroups = [];
	for (var i=0; i<userGroups.length; i++) {
		var group = userGroups[i];
		if (group.members.indexOf(author) !== -1 ) {
			inGroups.push(group);
		}
	}
	//var groupsMenu;
	//if (true || sr || inGroups.length > 0) {
	var groupsMenu = $('<select class="encryptselector">'+
		(sr&&PUBLIC_KEYS[sr] ? '<option value="'+sr+'">/r'+sr+'</option>' : '')+
		(PUBLIC_KEYS[author] ? '<option value="">to us only</option>' : '')+
		(function(){
			var list="";
			for (var i=0; i<inGroups.length; i++) {
				list += ('<option value="'+inGroups[i].name+'"">@'+inGroups[i].name+'</option>');
			}
			return list;
		})()+
		'</select>').insertAfter(eb);
	groupsMenu.css("width","120px");
	//}
	eb.on('change', function(){
		if (ta.hasClass("encrypted")) {
			if (groupsMenu) {
				groupsMenu.attr("disabled","disabled");
			}
			ta.css('background-color','inherit').css('color','inherit');
		} else {
			if (groupsMenu) {
				groupsMenu.attr("disabled",null);
			}
			ta.css('background-color','black').css('color','white');
		}
		ta.toggleClass("encrypted");
	});
	var sb = form.find('.save').first();
	sb.on('click', function(){
		var checkbox = $(this).closest('div').find('input').first();
		if (checkbox.attr('checked')==='checked') {
			//TODO: If there's a server-side error, restore the plaintext.
			var plaintext = ta.val();
			if (plaintext.length === 0) {
				return false; //Don't allow empty comments!
			}
			var keys = [];
			
			//If we're encrypting to a group, add all the keys for that group.
			//If we're encrypting to a subreddit, add that subreddit's key.
			var isToSubreddit = false;
			if (groupsMenu && groupsMenu.val()) {
				if (groupsMenu.val().charAt(0)==="/") {
					keys.push(PUBLIC_KEYS[groupsMenu.val()]);
					isToSubreddit = true;
				} else {
					var toGroup;
					for (var i=0; i<userGroups.length; i++) {
						if (userGroups[i].name === groupsMenu.val()) {
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
				var postingAs = $(".user").first().children().first().text();
				if (PUBLIC_KEYS[postingAs]) {
					if (keys.indexOf(PUBLIC_KEYS[postingAs]) === -1) {
						keys.push(PUBLIC_KEYS[postingAs]);
					}
				} else {
					if (!confirm("You won't be able to read this message later because you don't have a keypair loaded for /u/"+postingAs+". Continue?")) {
						return false;
					}
				}
			}
			var encryption = encrypt(plaintext, keys);
			if (encryption) {
				if (encryption.length > 10000) {
					alert("Error: The encryption would be too long.");
					return false;
				} else {
					ta.val(encryption);
					ta.css('background-color','inherit').css('color','inherit');
					ta.toggleClass("encrypted");
					checkbox.attr('checked',null);

					//Apply transformations to that thing and stop listening.

					var thingsOnPage = $(".sitetable").find(".thing");
					var numberOfThings = thingsOnPage.length;
					var newThingListener = setInterval((function(){
						//var child = form.closest(".child");
						if (true) {
							return function(){
								console.log("Checking for new thing");
								var thingsNowOnPage = $(".sitetable").find(".thing");
								if (thingsNowOnPage.length > numberOfThings) {
									console.log("New thing detected!");

									thingsNowOnPage.each(function(){
										thisThingClassSelector = ("."+$(this).attr("class").replace(/ /g, ".")).replace("..",".");
										thisThingClassSelector = thisThingClassSelector.slice(0, thisThingClassSelector.length-1);
										// Is this thing a new one?
										if (thingsOnPage.filter(thisThingClassSelector).length === 0) {
											// do something with $(this).find(".noncollapsed").find("form").first()
											var newElement = $(thisThingClassSelector).find(".noncollapsed");
											//console.log("##", thisThingClassSelector);
											//console.log("######", newForm, newForm.length);
											decryptElement(newElement.find("div.md"));


			//begin WET code
			var modmailIsEncryptable = false;
			var modmailSubreddit = 
				newElement.closest(".message-parent")
				.find("span.correspondent.reddit")
				.find("a").first().text();

			//console.log("WE've identified the modmail subreddit as:", modmailSubreddit);
			if (PUBLIC_KEYS[modmailSubreddit.slice(2)]) {
				modmailIsEncryptable = true;
			}
			var authorElement = newElement.find(".author").first();
			var author;
			if (authorElement.length > 0) {
				author = authorElement.text();
			} else {
				//It must be a modmail message from myself.
				author = $(".user").first().children().first().text(); //TODO: make that a global variable
			}
			//console.log("NEW COMMENT AUTHOR", author, PUBLIC_KEYS[author]);
			if (PUBLIC_KEYS[author]) {
				//console.log("Distinguishing:", authorElement);
				authorElement.css("background-color","black").css("color","yellow").css("padding","3px");
				authorElement.addClass("encryptable");
				var rrb = newElement.find(".buttons").find("a:contains('reply')").first();
				//I think that actually still works.
				if (rrb.length === 1) {				
					rrb.on('click',function() {
						if (!$(this).attr('alreadyclicked')) {
							$(this).attr("alreadyclicked","yes");
							var thing = $(this).closest('.thing');
							var form = thing.find(".cloneable").first();
							if (topFormIsEncryptable) {
								removeEncryptionOptions(form);
							}
							addEncryptionOptions(form, author, modmailSubreddit);
						}
					});
				}
			} else if (subredditIsEncryptable || modmailIsEncryptable) { //TODO: refactor to avoid duplication
				var rrb = newElement.find(".buttons").find("a:contains('reply')").first();
				if (rrb.length === 1) {				
					rrb.on('click',function() {
						if (!$(this).attr('alreadyclicked')) {
							$(this).attr("alreadyclicked","yes");
							var thing = $(this).closest('.thing');
							var form = thing.find(".cloneable").first();
							if (topFormIsEncryptable) {
								removeEncryptionOptions(form);
							}
							addEncryptionOptions(form, author, modmailSubreddit);
						}
					});
				}
			}
			//end WET code




										}
									});
									clearInterval(newThingListener);
									
								}
								
							};
						}


					})(), 100);
					return true;
				}
			} else {
				return false;
			}
		} else {
			var plaintext = ta.val();
			if (plaintext.indexOf("-----BEGIN PGP PRIVATE KEY BLOCK-----") !== -1 && plaintext.indexOf("-----END PGP PRIVATE KEY BLOCK-----") !== -1) {
				alert("It looks like you're trying to post a private key in an unencrypted message. "+
					"This would irrevocably spoil the key for everyone who's using it. "+
					"Please encrypt it before sending.");
				return false;
			}
			return true;
		}
	});
}


function removeEncryptionOptions(form) {
	form.find(".encryptbox").remove();
	form.find(".encryptselector").remove();
	var ta = form.find('textarea').first();
	ta.css('background-color','inherit').css('color','inherit');
	var sb = form.find('.save').first();
	sb.on('click', null);
}

var topFormIsEncryptable = false;

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

	//$(".author").each(function(){
	$(".tagline").each(function(){
		var modmailIsEncryptable = false;
		var modmailSubreddit = 
			$(this).closest(".message-parent")
			.find("span.correspondent.reddit")
			.find("a").first().text();
		if (PUBLIC_KEYS[modmailSubreddit.slice(2)]) {
			modmailIsEncryptable = true;
		}
		var authorElement = $(this).find(".author").first();
		var author;
		if (authorElement.length > 0) {
			author = authorElement.text();
		} else {
			//It must be a modmail message from myself.
			author = $(".user").first().children().first().text(); //TODO: make that a global variable
		}
		if (PUBLIC_KEYS[author]) {
			authorElement.css("background-color","black").css("color","yellow").css("padding","3px");
			authorElement.addClass("encryptable");
		}
		if (PUBLIC_KEYS[author] || modmailIsEncryptable) {
			var rrb = $(this).closest(".noncollapsed").find(".buttons").find("a:contains('reply')").first();
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
						if (!PUBLIC_KEYS[author]) {
							form.find('.save').first().closest('div').find('input').first().click();
						}
					}
				});
			}
		} else if (subredditIsEncryptable || modmailIsEncryptable) { //TODO: refactor to avoid duplication
			var rrb = $(this).closest(".noncollapsed").find(".buttons").find("a:contains('reply')").first();
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
					}
				});
			}
		}
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
    	if ($(this).text().indexOf("-----BEGIN PGP PRIVATE KEY BLOCK-----") !== -1) {
    		distinguishPrivateKeyElement($(this));
    	}
    });
}