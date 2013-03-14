
// This uses require.js to structure javascript:
// http://requirejs.org/docs/api.html#define

define(function(require) {
    // Zepto provides nice js and DOM methods (very similar to jQuery,
    // and a lot smaller):
    // http://zeptojs.com/
    var $ = require('zepto');

    // Need to verify receipts? This library is included by default.
    // https://github.com/mozilla/receiptverifier
    require('receiptverifier');

    // Want to install the app locally? This library hooks up the
    // installation button. See <button class="install-btn"> in
    // index.html
    require('./install-button');

    // Evopedia javascript dependencies
    var bzip2 = require('bzip2');
    var remove_diacritics = require('remove_diacritics');
    var evopedia = require('evopedia');


var dataFiles=document.getElementById('dataFiles').files;
var titleFile=document.getElementById('titleFile').files[0];

// Define behavior of HTML elements
$('#searchTitles').on('click', function(e) {
searchTitlesFromPrefix(titleFile,$('#prefix').val());
});
$('#titleList').on('change', function(e) {
updateOffsetsFromTitle(this.value);
});
$('#toggleDebug').on('click', function(e) {
switchDebugOnOff();
});
$('#readData').on('click', function(e) {
readArticleFromHtmlForm(dataFiles);
});
$('#prefix').on('keyup', function(e) {
onKeyUpPrefix(e);
});


// Detect if DeviceStorage is available
var storage = null;
if ($.isFunction(navigator.getDeviceStorage)) {
	storage = navigator.getDeviceStorage('sdcard');
}

if (storage != null) {
	var filerequest = storage.get('wikipedia_small_2010-08-14/wikipedia_00.dat');
	filerequest.onsuccess = function() {
		dataFiles = [];
		dataFiles[0] = filerequest.result;
		filerequest = storage.get('wikipedia_small_2010-08-14/titles.idx');
		filerequest.onsuccess = function() {
			titleFile = filerequest.result;
		};
		filerequest.onerror = function(event) {
			alert("error reading title file : " + event.target.error.name);
		};
	};
	filerequest.onerror = function(event) {
		alert("error reading data file : " + event.target.error.name);
	};
}
else {
	displayFileSelect();
}

/**
 * Displays the zone to select files from the dump
 */
function displayFileSelect() {
	$('#openLocalFiles').show();
	document.getElementById('dataFiles').addEventListener('change', handleDataFileSelect, false);
	document.getElementById('titleFile').addEventListener('change', handleTitleFileSelect, false);
}

var debugOn = false;

/**
 * Print the given string inside the debug zone
 * @param string
 */
function debug(string) {
	if (debugOn) {
		document.getElementById("debugTextarea").value+=string+"\n";
	}
}

/**
 * Switch debug mode On/Off
 */
function switchDebugOnOff() {
	if (debugOn == true) {
		debugOn = false;
		$('#debugZone').hide();
	}
	else {
		debugOn = true;
		$('#debugZone').show();
	}
}

/**
 * Set the Offsets HTML fields from the selected title
 */
function updateOffsetsFromTitle(selectValue) {
	var offsets=selectValue.split(/\|/);
	document.getElementById("filenumber").value=offsets[0];
	document.getElementById("blockstart").value=offsets[1];
	document.getElementById("blockoffset").value=offsets[2];
	document.getElementById("length").value=offsets[3];
	if (offsets[0]==255) {
		// It's a redirect : find out the real offsets (asynchronous read)
		readRedirectOffsets(titleFile,offsets[1]);
	}
	else {
		document.getElementById('redirectfilenumber').value = "";
		document.getElementById('redirectblockstart').value = "";
		document.getElementById('redirectblockoffset').value = "";
		document.getElementById('redirectlength').value = "";
	}
}

/**
 * This function is recursively called after each asynchronous read,
 * so that to find the closest index in titleFile to the given prefix
 */
function recursivePrefixSearch(titleFile, reader, prefix, lo, hi) {
	if (lo < hi-1 ) {
		var mid = Math.round((lo+hi)/2);
		// TODO : improve the way we read this file : 256 bytes is arbitrary and might be too small
		var blob = titleFile.slice(mid,mid+256);
		reader.onload = function(e) {
			var binaryTitleFile = e.target.result;
			var byteArray = new Uint8Array(binaryTitleFile);
			// Look for the index of the next NewLine
			var newLineIndex=0;	
			while (newLineIndex<byteArray.length && byteArray[newLineIndex]!=10) {
				newLineIndex++;
			}
			var i = newLineIndex+1;
			newLineIndex = i+15;
			// Look for the index of the next NewLine	
			while (newLineIndex<byteArray.length && byteArray[newLineIndex]!=10) {
				newLineIndex++;
			}
			var title = evopedia.utf8ByteArrayToString(byteArray,i+15,newLineIndex);
			debug("title found : "+title);
			if (title.localeCompare(prefix)<0) {
				lo = mid;
			}
			else {
				hi = mid;
			}
			recursivePrefixSearch(titleFile, reader, prefix, lo, hi);
		};
		debug("Reading the file from "+mid+" to "+(mid+256)+" because lo="+lo+" and hi="+hi);			
		// Read the file as a binary string
		reader.readAsArrayBuffer(blob);		
	}
	else {
		// We found the closest title
		debug ("Found the closest title near index "+lo);
		readTitlesBeginningAtIndexStartingWithPrefix(titleFile,prefix,lo);
	}
}

/**
 * Search the index for titles that start with the given prefix
 * (implemented with a binary search inside the index file)
 */
function searchTitlesFromPrefix(titleFile, prefix) {
	if (titleFile) {
		var titleFileSize = titleFile.size;
		prefix = remove_diacritics.normalizeString(prefix);

		var reader = new FileReader();
		reader.onerror = errorHandler;
		reader.onabort = function(e) {
			alert('Title file read cancelled');
		};
		recursivePrefixSearch(titleFile, reader, prefix, 0, titleFileSize);
	}
	else {
		alert ("Title file not set");
	}
}

/**
 * Read the real offsets when a redirect was found, based on the redirectIndex provided
 * The file read is asynchronous, and populates the html form as soon as the offsets are found
 * @param titleFile
 * @param redirectIndex
 */
function readRedirectOffsets(titleFile,redirectIndex) {
	var reader = new FileReader();
	reader.onerror = errorHandler;
	reader.onabort = function(e) {
		alert('Title file read cancelled');
	};
	reader.onload = function(e) {
		var binaryTitleFile = e.target.result;
		var byteArray = new Uint8Array(binaryTitleFile);
		var filenumber = byteArray[2];

		var blockstart = evopedia.readIntegerFrom4Bytes(byteArray,3);
		var blockoffset = evopedia.readIntegerFrom4Bytes(byteArray,7);
		var length = evopedia.readIntegerFrom4Bytes(byteArray,11);

		document.getElementById('redirectfilenumber').value = filenumber;
		document.getElementById('redirectblockstart').value = blockstart;
		document.getElementById('redirectblockoffset').value = blockoffset;
		document.getElementById('redirectlength').value = length;
	};
	// Read only the 16 necessary bytes
	var blob = titleFile.slice(redirectIndex,redirectIndex+16);
	// Read in the file as a binary string
	reader.readAsArrayBuffer(blob);
}

/**
 * Read the titles following the given index in the title file, until one of the following conditions is reached :
 * - the title does not start with the prefix anymore
 * - we already read the maximum number of titles
 * and populate the dropdown list
 */
function readTitlesBeginningAtIndexStartingWithPrefix(titleFile,prefix,startIndex) {
	var reader = new FileReader();
	reader.onerror = errorHandler;
	reader.onabort = function(e) {
		alert('Title file read cancelled');
	};
	reader.onload = function(e) {
		var binaryTitleFile = e.target.result;
		var byteArray = new Uint8Array(binaryTitleFile);
		// Look for the index of the next NewLine
		var newLineIndex=0;	
		while (newLineIndex<byteArray.length && byteArray[newLineIndex]!=10) {
			newLineIndex++;
		}
		var i = newLineIndex;
		var titleNumber=0;
		var comboTitleList = document.getElementById('titleList');
		while (i<byteArray.length && titleNumber<50) {
			// Look for the index of the next NewLine
			newLineIndex+=15;
			while (newLineIndex<byteArray.length && byteArray[newLineIndex]!=10) {
				newLineIndex++;
			}
			
			// Copy the encodedTitle in a new Array
			var encodedTitle = new Uint8Array(newLineIndex-i);
			for (var j = 0; j < newLineIndex-i; j++) {
				encodedTitle[j] = byteArray[i+j];
			}

			var title = evopedia.Title.parseTitle(encodedTitle, new evopedia.LocalArchive(), i);
			
			// Skip the titles that do not start with the prefix
			// TODO use a normalizer to compare the strings
			if (title && title.getReadableName().toLowerCase().indexOf(prefix.toLowerCase())==0) {
				comboTitleList.options[titleNumber] = new Option (title.name, title.fileNr + "|" + title.blockStart + "|" + title.blockOffset + "|" + title.articleLength);
				debug("Title : startIndex = " + i + " endIndex = " + newLineIndex + title.toString());
				titleNumber++;
			}
			i=newLineIndex+1;
		}
		// Update the offsets, as if the first item of the list was selected by the user
		updateOffsetsFromTitle($('#titleList').val());
	};
	var blob = titleFile.slice(startIndex);
	// Read in the file as a binary string
	reader.readAsArrayBuffer(blob);
}


/**
 * Decompress and read an article in dump files
 */
function readArticleFromHtmlForm(dataFiles) {
	document.getElementById("articleContent").innerHTML="Loading article from dump...";
	if (dataFiles && dataFiles.length>0) {
		var filenumber = document.getElementById('filenumber').value;
		var blockstart = document.getElementById('blockstart').value;
		var blockoffset = document.getElementById('blockoffset').value;
		var length = document.getElementById('length').value;
		if (filenumber==255) {
			// It's a redirect : use redirected offsets
			filenumber = document.getElementById('redirectfilenumber').value;
			blockstart = document.getElementById('redirectblockstart').value;
			blockoffset = document.getElementById('redirectblockoffset').value;
			length = document.getElementById('redirectlength').value;
			if (!filenumber || filenumber=="") {
				// TODO : better handle this case
				alert("Redirect offsets not read yet");
			}
		}
		var dataFile = null;
		// Find the good dump file
		for (var i=0; i<dataFiles.length; i++) {
			var fileName = dataFiles[i].name;
			var prefixedFileNumber = "";
			if (filenumber<10) {
				prefixedFileNumber = "0"+filenumber;
			}
			else {
				prefixedFileNumber = filenumber;
			}
			var expectedFileName = "wikipedia_"+prefixedFileNumber+".dat";
			// Check if the fileName ends with the expected file name (in case of DeviceStorage usage, the fileName is prefixed by the directory)
			if (fileName.match(expectedFileName+"$") == expectedFileName) {
				dataFile = dataFiles[i];
			}
		}
		if (!dataFile) {
			alert("File number " + filenumber + " not found");
			document.getElementById("articleContent").innerHTML="";
		}
		else {
			readArticleFromOffset(dataFile, blockstart, blockoffset, length);
		}
	}
	else {
		alert("Data files not set");
	}
}

/**
 * Read an article in a dump file, based on given offsets
 */
function readArticleFromOffset(dataFile, blockstart, blockoffset, length) {

	var reader = new FileReader();
	reader.onerror = errorHandler;
	reader.onabort = function(e) {
		alert('Data file read cancelled');
	};
	reader.onload = function(e) {
		var compressedArticles = e.target.result;
		//var htmlArticle = ArchUtils.bz2.decode(compressedArticles);
		// TODO : should be improved by uncompressing the content chunk by chunk,
		// until the length is reached, instead of uncompressing everything
		var htmlArticles = bzip2.simple(bzip2.array(new Uint8Array(compressedArticles)));
		// Start reading at offset, and keep length characters
		var htmlArticle = htmlArticles.substring(blockoffset,blockoffset+length);
		// Keep only length characters
		htmlArticle = htmlArticle.substring(0,length);
		// Decode UTF-8 encoding
		htmlArticle = decodeURIComponent(escape(htmlArticle));

		// Display the article inside the web page.		
		$('#articleContent').html(htmlArticle);

		// Convert links into javascript calls
		$('#articleContent').find('a').each(function(){
            // Store current link's url
            var url = $(this).attr("href");
            
            if(url.slice(0, 1) == "#") {
                // It's an anchor link : do nothing
            }
            else if (url.substring(0,4) === "http") {
            	// It's an external link : do nothing
            }
            else {
            	// It's a link to another article : add an onclick event to go to this article
            	// instead of following the link
            	$(this).on('click', function(e) {
              	   goToArticle($(this).attr("href"));
              	   return false;
                 });
            }

        });
	};

	// TODO : should be improved by reading the file chunks by chunks until the article is found,
	// instead of reading the whole file starting at blockstart
	var blob = dataFile.slice(blockstart);

	// Read in the image file as a binary string.
	reader.readAsArrayBuffer(blob);
}

function errorHandler(evt) {
	switch(evt.target.error.code) {
	case evt.target.error.NOT_FOUND_ERR:
		alert('File Not Found!');
		break;
	case evt.target.error.NOT_READABLE_ERR:
		alert('File is not readable');
		break;
	case evt.target.error.ABORT_ERR:
		break; // noop
	default:
		alert('An error occurred reading this file.');
	};
}

function handleDataFileSelect(evt) {
	dataFiles = evt.target.files;
}

function handleTitleFileSelect(evt) {
	titleFile = evt.target.files[0];
}

/**
 * Handle Enter key in the prefix input zone
 */
function onKeyUpPrefix(evt) {
	if (evt.keyCode == 13) {
		document.getElementById("searchTitles").click();
	}
}

/**
 * Replace article content with the one of the given title
 */
function goToArticle(title) {
	// This is awful and does not work very well.
	// It's just temporary before the algorithm is rewritten in an object-oriented way 
	// TODO : rewrite this with a real article search and display
	searchTitlesFromPrefix(titleFile,title);
	updateOffsetsFromTitle($('#titleList').val());
	document.getElementById("articleContent").innerHTML="";
}

});
