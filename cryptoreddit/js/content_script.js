var PRIVATE_KEYS = [];
var PUBLIC_KEYS = {};

chrome.storage.local.get('yourKeys', function(x) {
	var yourKeys;
	if (x.yourKeys && x.yourKeys.length) {
		yourKeys = x.yourKeys;
	} else {
		yourKeys = [];
	}
	for (var i=0; i<yourKeys.length; i++) {
		PRIVATE_KEYS.push(yourKeys[i].privateKeytext);
	}

	chrome.storage.local.get('othersKeys', function(y) {
		var othersKeys;
		if (y.othersKeys && y.othersKeys.length) {
			othersKeys = y.othersKeys;
		} else {
			othersKeys = [];
		}
		console.log(othersKeys);
		for (var i=othersKeys.length-1; i>=0; i--) {
			if (!PUBLIC_KEYS[othersKeys[i].username]) {
				PUBLIC_KEYS[othersKeys[i].username] = othersKeys[i].keytext;
			}
		}
		mainFunction();
	});
});




function encrypt(messageText, publicKey) {
  if (window.crypto.getRandomValues) {
    openpgp.init();
    var pub_key = openpgp.read_publicKey(publicKey);
    //var my_pub_key = openpgp.read_publicKey(MY_PUBLIC_KEY);
    //pub_key[1]=my_pub_key[0]; //Don't do this unless you can make sure that anonymity is not compromised when someone is using multiple accounts.
    return openpgp.write_encrypted_message(pub_key,messageText);
  } else {
    alert("Could not encrypt; your browser is not supported.");
    return false; 
  }
}



function decrypt(messageText, privateKey) {
  if (window.crypto.getRandomValues) {
    openpgp.init();
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
      return msg[0].decrypt(keymat, sesskey);
    } else {
      return false;
    }
  } else {
    console.log("Browser unsupported!");
    return false; 
  }
}


var mainFunction = function() {
	//Decrypt all messages whose keys we know.
    $('div.md').each(function(){
    	if ( $(this).text().indexOf("-----BEGIN PGP MESSAGE-----") === 0 ) {
    		var decryption;
    		for (var i=0; i<PRIVATE_KEYS.length; i++) {
    			decryption = decrypt($(this).text(), PRIVATE_KEYS[i]);
    			if (decryption) {break;}
    		}
    		if (decryption) {
	    		$(this).text(decryption);
	    		$(this).css('color','white');
	    		$(this).css('background-color','black');
	    		$(this).css('padding','5px');
	    		$(this).css('margin','5px');
    		} else {
    			$(this).css('color','#999');
    		}
    	}
    });

    //Optionally encrypt messages to people whose keys we know.
	$(".tagline").find(".author").each(function(){
		var author = $(this).text();
		if (PUBLIC_KEYS[author]) {
			$(this).css("background-color","black").css("color","yellow").css("padding","3px");
			var rrb = $(this).closest(".thing").find(".buttons").find("a:contains('reply')").first();
			rrb.on('click',function(){
				if (!$(this).attr('alreadyclicked')) {
					$(this).attr("alreadyclicked","yes")
					var thing = $(this).closest('.thing');
					var ta = thing.find('textarea');
					ta.addClass("encrypted");
					ta.css('background-color','black').css('color','white');
					var eb = $('<span> <input type="checkbox" checked="checked" />encrypt </span>').insertAfter(thing.find('.cancel').first());
					eb.on('change', function(){
						if (ta.hasClass("encrypted")) {
							ta.css('background-color','white').css('color','black');
						} else {
							ta.css('background-color','black').css('color','white');
						}
						ta.toggleClass("encrypted");
					});
					var sb = thing.find('.save').first();
					sb.on('click', function(){
						var checkbox = $(this).closest('div').find('input').first();
						if (checkbox.attr('checked')==='checked') {
							//TODO: If there's a server-side error, restore the plaintext.
							var plaintext = ta.val();
							var encryption = encrypt(plaintext, PUBLIC_KEYS[author]);
							if (encryption) {
								if (encryption.length > 10000) {
									alert("Error: The encryption would be too long.");
									return false;
								} else {
									ta.val(encryption);
									ta.css('background-color','white').css('color','black');
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
