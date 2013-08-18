var othersKeys;
var yourKeys;

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
			"<td>"+(entry.source===""?"<button class='publishButton'>publish</button>":"&nbsp;")+"</td> </tr>");
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
		var publishThisKey = (function(){
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
		})();
		newRow.find('.viewPublicButton').on('click',viewPublicKeytext);
		newRow.find('.viewPrivateButton').on('click',viewPrivateKeytext);
		newRow.find('.deleteButton').on('click',deleteThisKey);
		if (entry.source==="") {
			newRow.find('.publishButton').on('click',publishThisKey);
		}

	}
});



$(function(){
	$("#importButton").on('click', importKey);
	$("#generateYourButton").on('click', generate);
	$("#importYourButton").on('click', importYourKey);
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
		$('#importYourPublicKeytext').val( openpgp_encoding_armor(4, keyPair.publicKey.string) );
		$('#importYourPrivateKeytext').val( openpgp_encoding_armor(5, keyPair.privateKey.string) );
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
