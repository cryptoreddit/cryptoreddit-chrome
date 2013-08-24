var PRIVATE_KEYS = {};
var PUBLIC_KEYS = {};
var othersKeys;
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
		getYourKeys();
	});
}

function getYourKeys() {
	chrome.storage.local.get('yourKeys', function(x) {
		var yourKeys;
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
		});
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
				openpgp.read_publicKey(key.keytext);
				PUBLIC_KEYS[key.username] = key.keytext;
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
    var msg = openpgp.read_message(messageText);

    var keymat = null;
    var sesskey = null;

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
      	return msg[0].decrypt(keymat, sesskey);
      } catch(error) {
      	return false;
      }
      
    } else {
      return false;
    }
  } else {
    console.log("Browser unsupported!");
    return false; 
  }
}



function decryptElement(element) {
	var ciphertext = element.text();
	if (element.html().indexOf("//#__") !== -1) {
		ciphertext = element.html().replace(/_/g,"\n");
	}
	//TODO: Find a more permanent fix for this. Might be a bug in openpgpjs, or with us.
	ciphertext = ciphertext.replace("\n\n","_").replace(/\n\n/g, "\n").replace("_","\n\n");
	var decryption;
	var private_key_usernames = Object.keys(PRIVATE_KEYS);
	for (var i=0; i<private_key_usernames.length; i++) {
		decryption = decrypt(ciphertext, PRIVATE_KEYS[private_key_usernames[i]].privateKey);
		if (decryption) {break;}
	}
	if (decryption) {
		element.addClass("encrypted");
		element.text(decryption);
		element.css('color','white');
		element.css('background-color','black');
		element.css('padding','5px');
		element.css('margin','5px');
	} else {
		element.addClass("undecryptable");
		element.css('color','lightgray');
		element.css('font-size','5pt');
	}
}


function distinguishPublicKeyElement(element) {
	var username = element.closest("form").parent().find(".author").first().text();
	if (!PUBLIC_KEYS[username]) {
	    try {
			openpgp.read_publicKey(element.text());
			element.addClass("newpublickey");
			element.css('color','magenta');
    		element.css('cursor','pointer');
    		element.on('click', function(){
    			if (confirm("Import this key for user " + username + "?")) {
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
}

function undistinguishPublicKeyElement(element) {
	alert("Key imported! Reload to start sending encrypted messages to this user.");
	element.css('color','inherit');
	element.css('cursor','inherit');
	element.unbind('click');
	//TODO: distinguish this user as encryptable.
}



var mainFunction = function() {
	
    $('div.md').each(function(){
    	if ( $(this).text().indexOf("-----BEGIN PGP MESSAGE-----") === 0 ) {
    		//Decrypt all messages whose keys we know.
    		decryptElement($(this));
    	} else if ($(this).text().indexOf("-----BEGIN PGP PUBLIC KEY BLOCK-----") === 0) {
    		distinguishPublicKeyElement($(this));
    	}
    });

    //Optionally encrypt messages to people whose keys we know.
	$(".author").each(function(){
		var author = $(this).text();
		if (PUBLIC_KEYS[author]) {
			$(this).css("background-color","black").css("color","yellow").css("padding","3px");
			$(this).addClass("encryptable");
			var rrb = $(this).closest(".thing").find(".buttons").find("a:contains('reply')").first();
			rrb.on('click',function(){
				if (!$(this).attr('alreadyclicked')) {
					$(this).attr("alreadyclicked","yes")
					var thing = $(this).closest('.thing');
					var cancelB = thing.find(".cloneable").first().find('.cancel').first();
					var ta = thing.find(".cloneable").first().find('textarea').first();
					ta.addClass("encrypted");
					ta.css('background-color','black').css('color','white');
					var eb = $('<span> <input type="checkbox" checked="checked" />encrypt </span>').insertAfter(cancelB);
					var inGroups = [];
					for (var i=0; i<userGroups.length; i++) {
						var group = userGroups[i];
						if (group.members.indexOf(author) !== -1 ) {
							inGroups.push(group);
						}
					}
					var groupsMenu;
					if (inGroups.length > 0) {
						groupsMenu = $('<select> <option value="">to us only</option> '+
							(function(){
								var list="";
								for (var i=0; i<inGroups.length; i++) {
									list += ('<option value="'+inGroups[i].name+'"">@'+inGroups[i].name+'</option>');
								}
								return list;
							})()+
							'</select>').insertAfter(eb);
						groupsMenu.css("width","120px");
					}
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
					var sb = thing.find(".cloneable").first().find('.save').first();
					sb.on('click', function(){
						var checkbox = $(this).closest('div').find('input').first();
						if (checkbox.attr('checked')==='checked') {
							//TODO: If there's a server-side error, restore the plaintext.
							var plaintext = ta.val();
							var keys = [];
							//add our own key to the list...
							var postingAs = $(".user").first().children().first().text(); //DOES THIS WORK WITH RES? YES!
							if (PRIVATE_KEYS[postingAs]) {
								keys.push(PRIVATE_KEYS[postingAs].publicKey);
							} else {
								if (!confirm("You won't be able to read this message because you don't have a public/private keypair loaded for /u/"+postingAs+". Continue?")) {
									return false;
								}
							}
							
							if (groupsMenu && groupsMenu.val()) {
								var toGroup;
								for (var i=0; i<userGroups.length; i++) {
									if (userGroups[i].name === groupsMenu.val()) {
										toGroup = userGroups[i];
										break;
									}
								}
								//This should include the recipient as well.
								for (var i=0; i<toGroup.members.length; i++) {
									var memberKey = PUBLIC_KEYS[toGroup.members[i]];
									if (memberKey && keys.indexOf(memberKey) ===  -1) {
										keys.push(memberKey);
									}
								}
							} else {
								keys.push(PUBLIC_KEYS[author]);
							}
							var encryption = encrypt(plaintext, keys);
							if (encryption) {
								if (encryption.length > 10000) {
									//alert("Error: The encryption would be too long.");
									return false;
								} else {
									ta.val(encryption);
									ta.css('background-color','inherit').css('color','inherit');
									ta.toggleClass("encrypted");
									checkbox.attr('checked',null);
									return true;
								}
							} else {
								return false;
							}
						} else {
							return true;
						}
					});
				}
			});
		}
	});
}