var PRIVATE_KEYS = {};
var PUBLIC_KEYS = {};
var othersKeys;
var userGroups;

// Load stuff from memory, one by one
chrome.storage.local.get('userGroups', function(w) {
	if (w.userGroups && w.userGroups.length) {
		userGroups = w.userGroups;
	} else {
		userGroups = [];
	}

	chrome.storage.local.get('yourKeys', function(x) {
		var yourKeys;
		if (x.yourKeys && x.yourKeys.length) {
			yourKeys = x.yourKeys;
		} else {
			yourKeys = [];
		}
		for (var i=0; i<yourKeys.length; i++) {
			PRIVATE_KEYS[yourKeys[i].username] = {privateKey:yourKeys[i].privateKeytext, publicKey:yourKeys[i].publicKeytext};
		}

		chrome.storage.local.get('othersKeys', function(y) {
			//var othersKeys;
			if (y.othersKeys && y.othersKeys.length) {
				othersKeys = y.othersKeys;
			} else {
				othersKeys = [];
			}
			for (var i=othersKeys.length-1; i>=0; i--) {
				if (!PUBLIC_KEYS[othersKeys[i].username]) {
					try {
						openpgp.read_publicKey(othersKeys[i].keytext);
						PUBLIC_KEYS[othersKeys[i].username] = othersKeys[i].keytext;
					} catch(error) {
						console.log("Could not import invalid key for /u/"+othersKeys[i].username);
					}				
				}
			}
			mainFunction();
		});
	});
});








function decrypt(messageText, privateKey) {
  if (window.crypto.getRandomValues) {
    //openpgp.init();
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
	console.log("AFTER:", ciphertext);
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

var mainFunction = function() {
	
    $('div.md').each(function(){
    	if ( $(this).text().indexOf("-----BEGIN PGP MESSAGE-----") === 0 ) {
    		//Decrypt all messages whose keys we know.
    		decryptElement($(this));
    	} else if ($(this).text().indexOf("-----BEGIN PGP PUBLIC KEY BLOCK-----") === 0) {
    		//Distinguish public keys we don't have yet.
    		var username = $(this).closest("form").parent().find(".author").first().text();
    		if (!PUBLIC_KEYS[username]) {
			    try {
					openpgp.read_publicKey($(this).text());
	    			$(this).addClass("newpublickey");
	    			$(this).css('color','magenta');
		    		$(this).css('cursor','pointer');
		    		$(this).on('click', function(){
		    			if (confirm("Import this key for user "+username + "?")) {
		    				PUBLIC_KEYS[username] = $(this).text();
		    				//TODO: refactor to avoid repeating this code

							var timestamp = new Date().getTime();
							var source = "";
							var id=-1;
							for (var i=0; i<othersKeys.length; i++) {
								if (id < othersKeys[i].id) {
									id = othersKeys[i].id;
								}
							}
							id = id+1;
							var entry = {
								username:username,
								keytext:$(this).text(),
								timestamp:timestamp,
								source:source,
								id:id
							};
							othersKeys.push(entry);
							var keyDiv = $(this);
							chrome.storage.local.set({'othersKeys': othersKeys}, function() {
								alert("Key imported! Reload to start sending encrypted messages to this user.");
				    			keyDiv.css('color','inherit');
					    		keyDiv.css('cursor','inherit');
					    		keyDiv.unbind('click');
					    		//TODO: distinguish this user as encryptable.
							});
		    			}
		    		});
	    		} catch(error) {
					console.log("couldnt read", $(this).text(), error);
					return;
				}
    		}
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