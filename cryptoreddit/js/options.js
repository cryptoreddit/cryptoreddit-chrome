var othersKeys;
var yourKeys;
var userGroups;

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
			"<td><button class='viewButton'>view</button></td>"+
			"<td><button class='deleteButton'>delete</button></td> </tr>");
		var newRow = $('#row_'+entry.id);
		var viewKeytext = (function(){
			var kt = entry.keytext;
			return function(){
				alert(kt);
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
		newRow.find('.viewButton').on('click',viewKeytext);
		newRow.find('.deleteButton').on('click',deleteThisKey);
	}
});

chrome.storage.local.get('yourKeys', function(x) {
	if (x.yourKeys && x.yourKeys.length) {
		yourKeys = x.yourKeys;
	} else {
		yourKeys = [];
	}
	for (var i=yourKeys.length-1; i>=0; i--) {
		var entry = yourKeys[i];
		$("#yourKeysTable").append(
			"<tr id='yrow_"+entry.id+"'>"+
			"<td><a target='_blank' href='http://www.reddit.com/user/"+entry.username+"'>"+entry.username+"</a></td>"+
			"<td>"+new Date(entry.timestamp).toUTCString()+"</td>"+
			"<td><button class='viewPublicButton'>public</button></td>"+
			"<td><button class='viewPrivateButton'>private</button></td>"+
			"<td><button class='deleteButton'>delete</button></td>"+
			//"<td>"+(entry.source===""?"<button class='publishButton'>publish</button>":"&nbsp;")+"</td>"+
			"</tr>");
		var newRow = $('#yrow_'+entry.id);
		var viewPublicKeytext = (function(){
			var pbkt = entry.publicKeytext;
			return function(){
				alert(pbkt);
			};
		})();
		var viewPrivateKeytext = (function(){
			var pvkt = entry.privateKeytext;
			return function(){
				alert(pvkt);
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
		/*var publishThisKey = (function(){
			var pub = entry.publicKeytext;
			var usr = entry.username;
			var eid = entry.id;
			return function(){
				if (confirm("Are you logged in to Reddit as /u/"+usr+"? If not, press \"Cancel\", log in, and try again.")) {
					for (var k=0; k<yourKeys.length; k++) {
						if (yourKeys[k].id === eid) {
							yourKeys[k].source = "1";
							break;
						}
					}
					chrome.storage.local.set({'yourKeys': yourKeys}, function() {
						window.open("http://www.reddit.com/r/cryptoredditkeys/submit?selftext=true&title=USER%20KEY&text="+encodeURIComponent(pub));
					});
				}
			}
		})();*/
		newRow.find('.viewPublicButton').on('click',viewPublicKeytext);
		newRow.find('.viewPrivateButton').on('click',viewPrivateKeytext);
		newRow.find('.deleteButton').on('click',deleteThisKey);
		/*if (entry.source==="") {
			newRow.find('.publishButton').on('click',publishThisKey);
		}*/

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
				var newName = prompt("Change group name? Name must be 20 or fewer alphanumeric characters.", oldName);
				if (newName && newName != oldName) {
					if (newName.length <= 20 && /^[0-9a-zA-Z]+$/.test(newName)) {
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
					var newMemberList = prompt("Enter one or more users to add, separated by single spaces.");
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
		keytext:keytext,
		timestamp:timestamp,
		source:source,
		id:id
	};
	othersKeys.push(entry);
	chrome.storage.local.set({'othersKeys': othersKeys}, function() {
		window.location.reload();
	});
}

function generate() {
	if (window.crypto.getRandomValues) {
		var keyPair;
		openpgp.init();
		keyPair = openpgp_crypto_generateKeyPair(1,2048);
		var result1 = openpgp_encoding_armor(4, keyPair.publicKey.string);
		var result2 = openpgp_encoding_armor(5, keyPair.privateKey.string);
		result1 = result1.replace("Comment: http://openpgpjs.org", "Comment: /r/cryptoreddit");
		result2 = result2.replace("Comment: http://openpgpjs.org", "Comment: /r/cryptoreddit");
		$('#importYourPublicKeytext').val( result1 );
		$('#importYourPrivateKeytext').val( result2 );
	} else {
		window.alert("Your browser doesn't support this.");   
	}
}

function importYourKey() {
	var username = $("#importYourUsername").val();
	var publicKeytext = $("#importYourPublicKeytext").val();
	var privateKeytext = $("#importYourPrivateKeytext").val();

	if (!username || !publicKeytext || !privateKeytext || username==="" || publicKeytext==="" || privateKeytext==="" ) {
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
		window.location.reload();
	});
}

// TODO: refactor to avoid repeating this code.
function createGroup() {
	var newName = prompt("What should be the name of the new group? Name must be 20 or fewer alphanumeric characters.");
	if (newName) {
		if (newName.length <= 20 && /^[0-9a-zA-Z]+$/.test(newName)) {
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


//TODO: Refactor to eliminate repetition
function encrypt(messageText, listOfPublicKeys) {
  if (window.crypto.getRandomValues) {
  	try {
	    openpgp.init();
	    var pub_key = openpgp.read_publicKey(listOfPublicKeys[0]);;
	    for (var i=1; i<listOfPublicKeys.length; i++) {
	    	pub_key[i] = openpgp.read_publicKey(listOfPublicKeys[i])[0];
	    }
	    var result = openpgp.write_encrypted_message(pub_key,messageText);
	    result = result.replace("Comment: http://openpgpjs.org", "Comment: /r/cryptoreddit");
	    return result;
	} catch(error) {
		return false;
	}
  } else {
    return false; 
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
				for (var j=othersKeys.length-1; j>=0; j--) {
					if (othersKeys[j].username === includee) {
						listOfPublicKeys.push(othersKeys[j].keytext);
						break;
					}
				}
			}
		}

		var encryption = encrypt(cleartextMessage, listOfPublicKeys);
		if (encryption) {
			$("#encryptedMessage").val(encryption);
		} else {
			alert("Could not encrypt. One or more of the keys may be invalid, or your browser is unsupported.");
			return;
		}
	} else {
		return;
	}
	
}





