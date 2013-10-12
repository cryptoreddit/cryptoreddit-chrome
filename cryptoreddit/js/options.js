var othersKeys;
var yourKeys;
var userGroups;
var messageCache;

chrome.storage.local.get('othersKeys', function(x) {
	if (x.othersKeys && x.othersKeys.length) {
		othersKeys = x.othersKeys;
	} else {
		othersKeys = [];
	}
	for (var i=othersKeys.length-1; i>=0; i--) {
		var entry = othersKeys[i];
		$("#othersKeysTable").append(
			"<tr id='row_"+entry.id+"'>"+
			"<td><a target='_blank' href='http://www.reddit.com/user/"+entry.username+"'>"+entry.username+"</a></td>"+
			"<td>"+new Date(entry.timestamp).toUTCString()+"</td>"+
			"<td><button class='showButton'>show</button></td>"+
			"<td><button class='deleteButton'>delete</button></td> </tr>");
		var newRow = $('#row_'+entry.id);
		var showKeytext = (function(){
			var un = entry.username;
			var kt = entry.keytext;
			return function(){
				$("#importUsername").val(un);
				$("#importKeytext").val(kt);
			};
		})();
		var deleteThisKey = (function(){
			var eid = entry.id;
			return function(){
				if (confirm("Delete this key?")) {
					for (var j=othersKeys.length-1; j>=0; j--) {
					    if(othersKeys[j].id == eid) {
					        othersKeys.splice(j,1);
					    }
					}
					chrome.storage.local.set({'othersKeys': othersKeys}, function() {
						window.location.reload();
					});
				}
			}
		})();
		newRow.find('.showButton').on('click',showKeytext);
		newRow.find('.deleteButton').on('click',deleteThisKey);
	}
});


function addKeypairToTable(entry, prepending) {
	var newRowHTML = "<tr id='yrow_"+entry.id+"'>"+
		"<td><a target='_blank' href='http://www.reddit.com/"+(entry.username.charAt(0)==="/" ? "r" : "user/")+entry.username+"'>"+entry.username+"</a></td>"+
		"<td>"+new Date(entry.timestamp).toUTCString()+"</td>"+
		"<td><button class='showYourButton'>show</button></td>"+
		"<td><button class='deleteButton'>delete</button></td>"+
		//"<td>"+(entry.source===""?"<button class='publishButton'>publish</button>":"&nbsp;")+"</td>"+
		"</tr>";
	if (prepending) {
		$("#yourKeysTable").prepend(newRowHTML);
	} else {
		$("#yourKeysTable").append(newRowHTML);
	}
	var newRow = $('#yrow_'+entry.id);
	var showKeytext = (function(){
		var un = entry.username;
		var pbkt = entry.publicKeytext;
		var pvkt = entry.privateKeytext;
		return function(){
			$("#importYourUsername").val(un);
			$("#importYourPublicKeytext").val(pbkt);
			$("#importYourPrivateKeytext").val(pvkt);
		};
	})();
	var deleteThisKey = (function(){
		var eid = entry.id;
		return function(){
			if (confirm("Delete this key? You will no longer be able to read messages that have been encrypted to it.")) {
				for (var j=yourKeys.length-1; j>=0; j--) {
				    if(yourKeys[j].id == eid) {
				        yourKeys.splice(j,1);
				    }
				}
				chrome.storage.local.set({'yourKeys': yourKeys}, function() {
					window.location.reload();
				});
			}
		}
	})();
	newRow.find('.showYourButton').on('click',showKeytext);
	newRow.find('.deleteButton').on('click',deleteThisKey);
}

chrome.storage.local.get('yourKeys', function(x) {
	if (x.yourKeys && x.yourKeys.length) {
		yourKeys = x.yourKeys;
	} else {
		yourKeys = [];
	}
	for (var i=yourKeys.length-1; i>=0; i--) {
		var entry = yourKeys[i];
		addKeypairToTable(entry);
	}
});



chrome.storage.local.get('userGroups', function(x) {
	if (x.userGroups && x.userGroups.length) {
		userGroups = x.userGroups;
	} else {
		userGroups = [];
	}
	for (var i=userGroups.length-1; i>=0; i--) {
		var group = userGroups[i];
		$("#userGroupsTable").append(
			"<tr id='grow_"+group.name+"'>"+
			"<td><button class='changeNameButton'>@"+group.name+"</button></td>"+
			"<td>"+group.members.length+" members</td>"+
			"<td><select class='memberSelector'><option value='-1'>(add new members)</option>"+
			(function(optionList){
				var output = "";
				for (var j=0; j<optionList.length; j++) {
					output += ("<option value='"+j+"'>"+optionList[j]+"</option>");
				}
				return output;
			})(group.members)+
			"</select></td>"+
		    "<td><button class='addOrRemoveButton'>add/remove</button></td>"+
		    "<td><button class='deleteGroupButton'>delete group</button></td>"+
			"</tr>"
		);
		var newRow = $('#grow_'+group.name);

		var changeThisName = (function(){
			var oldName = group.name;
			var gi = i;
			return function(){
				var newName = prompt("Change group name? Name must be 20 or fewer alphanumeric_ characters.", oldName);
				if (newName && newName != oldName) {
					if (newName.length <= 20 && /^[0-9a-zA-Z_]+$/.test(newName)) {
						if (!(function(list, targetName){
							for (var m=0; m<list.length; m++) {
								if (list[m].name == targetName) {
									return true;
								}
							}
							return false;
						})(userGroups, newName)) {
							userGroups[gi].name = newName;
							chrome.storage.local.set({'userGroups': userGroups}, function() {
								window.location.reload();
							});
						} else {
							alert("Name is already taken.");
						}
	
					} else {
						alert("Invalid name.");
					}
				}
			};
		})();

		var addOrRemoveMembers = (function(){
			var gi = i;	
			var nr = newRow;
			var gm = group.members;
			return function(){
				var selectionID = parseInt(nr.find('.memberSelector').val());
				if (selectionID === -1) {
					var newMemberList = prompt("Enter one or more users to add, separated by single spaces. Usernames are case-sensitive.");
					if (newMemberList) {
						var newMembers = newMemberList.split(" ");
						var membersToAdd = [];
						for (var j=0; j<newMembers.length; j++) {
							var newMember = newMembers[j];
							if (!(newMember.length <= 20 && /^[0-9a-zA-Z_-]+$/.test(newMember))) {
								alert("Invalid username: "+newMember);
								return;
							} else if ( gm.indexOf(newMember) === -1 && membersToAdd.indexOf(newMember)===-1 ) {
								membersToAdd.push(newMember);
							}
						}
						userGroups[gi].members = userGroups[gi].members.concat(membersToAdd);
						chrome.storage.local.set({'userGroups': userGroups}, function() {
							window.location.reload();
						});
					}
				} else {
					if (confirm("Remove member "+gm[selectionID] + "?")) {
						userGroups[gi].members.splice(selectionID,1);
						chrome.storage.local.set({'userGroups': userGroups}, function() {
							window.location.reload();
						});
					}
				}
			}
		})();


		var deleteThisGroup = (function(){
			var gi = i;
			return function(){
				if (confirm("Delete this group?")) {
					userGroups.splice(gi,1);
					chrome.storage.local.set({'userGroups': userGroups}, function() {
						window.location.reload();
					});
				}
			}
		})();

		newRow.find('.changeNameButton').on('click',changeThisName);
		newRow.find('.addOrRemoveButton').on('click',addOrRemoveMembers);
		newRow.find('.deleteGroupButton').on('click',deleteThisGroup);

	}
});


chrome.storage.local.get('messageCache', function(z) {
	if (z.messageCache && Object.keys(z.messageCache).length) {
		messageCache = z.messageCache;
	} else {
		messageCache = {"-1": 1440};
	}
	$("#cacheTime").val(messageCache[-1]);
	$("#cacheCount").text(Object.keys(messageCache).length-1);
	$("#setCacheTimeButton").on('click', setCacheTime);
	$("#clearCacheButton").on('click', clearCache);
	//console.log(messageCache);
});


function setCacheTime() {
	messageCache[-1] = parseInt($("#cacheTime").val());
	chrome.storage.local.set({'messageCache': messageCache}, function() {
		window.location.reload();
	});
}

function clearCache() {
	if (confirm("Clear the message cache?")) {
		messageCache = {"-1": messageCache[-1]};
		chrome.storage.local.set({'messageCache': messageCache}, function() {
			window.location.reload();
		});
	}
}




$(function(){
	$("#importButton").on('click', importKey);
	$("#generateYourButton").on('click', generate);
	$("#importYourButton").on('click', importYourKey);
	$("#createGroupButton").on('click', createGroup);
	$("#dumpButton").on('click', dumpBackup);
	$("#loadButton").on('click', loadBackup);
	$("#encryptButton").on('click', encryptMessage);
});


function importKey() {
	var username = $("#importUsername").val();
	var keytext = $("#importKeytext").val();
	if (!username || !keytext || username==="" || keytext==="") {
		return;
	}
	try {
		openpgp.read_publicKey(keytext);
	} catch(error) {
		alert("Key is invalid!");
		return;
	}

	addPublicKeyForUser(username, keytext, function(){window.location.reload();});

}

function generate() {
	var username = $("#importYourUsername").val();
	if (!username) {
		alert("You must enter a username!");
		return;
	}
	if (window.crypto.getRandomValues) {
		$("#generateYourButton").text("this may take a moment...").attr("disabled","disabled");
		setTimeout(function(){
			var keyPair;
			openpgp.init();
			keyPair = openpgp_crypto_generateKeyPair(1,2048);
			var result1 = openpgp_encoding_armor(4, keyPair.publicKey.string);
			var result2 = openpgp_encoding_armor(5, keyPair.privateKey.string);
			var sr;
			if (username.charAt(0) === "/") {
				sr = username;
			}
			result1 = rewriteComment(result1, false, sr);
			result2 = rewriteComment(result2, false, sr);
			$('#importYourPublicKeytext').val( result1 );
			$('#importYourPrivateKeytext').val( result2 );
			if (sr) {
				alert("You just generated a subreddit keypair, whose private key you can share. But never share it in any unencrypted message!");
			} else {
				alert("Copy your public key into a comment to share it. And don't forget to back up your private key too!" );
			}
			importYourKey(true);
		},10);
	} else {
		window.alert("Your browser doesn't support this.");   
	}
}

function importYourKey(dontReload) {
	var username = $("#importYourUsername").val();
	var publicKeytext = $("#importYourPublicKeytext").val();
	var privateKeytext = $("#importYourPrivateKeytext").val();

	if (!username || !publicKeytext || !privateKeytext || username==="" || publicKeytext==="" || privateKeytext==="" ) {
		return;
	}
	try {
		openpgp.read_publicKey(publicKeytext);
		openpgp.read_privateKey(privateKeytext);
	} catch(error) {
		alert("Key is invalid!");
		return;
	}
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
		username:username,
		publicKeytext:publicKeytext,
		privateKeytext:privateKeytext,
		timestamp:timestamp,
		source:source,
		id:id
	};

	yourKeys.push(entry);
	chrome.storage.local.set({'yourKeys': yourKeys}, function() {
		if (dontReload) {
			addKeypairToTable(entry, true);
			$("#generateYourButton").text("generate and save").attr("disabled",null);
		} else {
			window.location.reload();
		}
	});
}

// TODO: refactor to avoid repeating this code.
function createGroup() {
	var newName = prompt("What should be the name of the new group? Name must be 20 or fewer alphanumeric_ characters.");
	if (newName) {
		if (newName.length <= 20 && /^[0-9a-zA-Z_]+$/.test(newName)) {
			if (!(function(list, targetName){
				for (var m=0; m<list.length; m++) {
					if (list[m].name == targetName) {
						return true;
					}
				}
				return false;
			})(userGroups, newName)) {
				userGroups.push({name:newName, members:[]});
				chrome.storage.local.set({'userGroups': userGroups}, function() {
					window.location.reload();
				});
			} else {
				alert("Name is already taken.");
			}
		} else {
			alert("Invalid name.");
		}
	}
}


function dumpBackup() {
	$("#backup").val(JSON.stringify({othersKeys:othersKeys,yourKeys:yourKeys,userGroups:userGroups}));
}

function loadBackup() {
	if (confirm('This will overwrite your existing keys and groups, if any. Continue?')) {
		var backupObject;
		try {
			backupObject = JSON.parse($("#backup").val());
			chrome.storage.local.set(backupObject, function() {
				window.location.reload();
			});
		} catch(error) {
			alert("Error: Could not parse backup.");
			return;
		}
		
	}
}



function encryptMessage() {
	var recipientsList = $("#recipients").val();
	var cleartextMessage = $("#cleartextMessage").val();
	if (cleartextMessage) {
		//Process the recipients list
		if (!recipients) {
			recipients = [];
		}
		var recipients = recipientsList.split(" ");
		var inclusions = [];
		var exclusions = [];
		for (var i=0; i<recipients.length; i++) {
			var recipient = recipients[i];
			if (!recipient) {
				continue;
			} else if (recipient.indexOf("!") === 0) {
				exclusions.push(recipient.slice(1));
			} else if (recipient.indexOf("@") === 0) {
				var groupName = recipient.slice(1);
				var group;
				for (var j=0; j<userGroups.length; j++) {
					if (userGroups[j].name === groupName) {
						group = userGroups[j];
					}
				}
				if (group) {
					var members = group.members;
					for (var j=0; j<members.length; j++) {
						inclusions.push(members[j]);
					}
				} else {
					alert("Error: You don't have a group called "+recipient);
					return;
				}
			} else {
				inclusions.push(recipient);
			}
		}

		var listOfPublicKeys = [];

		//TODO: Is there a more efficient way to do this?
		if (inclusions.length === 0) {
			for (var j=othersKeys.length-1; j>=0; j--) {
				if (inclusions.indexOf(othersKeys[j].username) === -1) {
					inclusions.push(othersKeys[j].username);
				}
			}
		}

		for (var i=0; i<inclusions.length; i++) {
			var includee = inclusions[i];
			if (exclusions.indexOf(includee) === -1) {
				var added = false;
				for (var j=othersKeys.length-1; j>=0; j--) {
					if (othersKeys[j].username === includee) {
						listOfPublicKeys.push(openpgp.read_publicKey(othersKeys[j].keytext));
						added = true;
						break;
					}
				}
				if (!added) {
					for (var j=yourKeys.length-1; j>=0; j--) {
						if (yourKeys[j].username === includee) {
							listOfPublicKeys.push(openpgp.read_publicKey(yourKeys[j].publicKeytext));
							break;
						}
					}
				}

			}
		}

		var ctf = parseInt($("#ciphertextFormatSelector").val());
		var encryption = encrypt(cleartextMessage, listOfPublicKeys, ctf);
		if (ctf === 2) {
			encryption = "\t"+encryption.replace(/\n/g,"\n\t");
		}
		if (encryption) {
			$("#encryptedMessage").val(encryption);
		} else {
			return;
		}
	} else {
		return;
	}
	
}





