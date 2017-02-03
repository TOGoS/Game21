(function() {
"use strict";

// Used to translate https://s31.postimg.org/r8hi9reqj/IBM_5140_8x8.png
// into a big-endian 1-bit-per-pixel byte array
// (leftmost bit of each row is the highest bit in the corresponding byte)
// This is the same encoding used by BitImgs

const dataUri = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAQAAABpN6lAAAAAAmJLR0QASaWN\n2gYAAAAJcEhZcwAACxMAAAsTAQCanBgAAAAHdElNRQfgBhUCJAdeH0NEAAAL\nFUlEQVR42u1dWXbbMAy0+HS5+MC+nvshs8QyA4CU4iZp1NckskSJBEEsA4De\nPm7+eDyP3/eNn9+34+doM/7uLfQn8sy/qx/2Ln59vMP2D/dn9P5oc5w31KX7\ndvw7Hjy6IM/1tcfT32c/sUM5e+jpkIRApLtvj6ft1+P5eDY0/D643uh4lX8F\nG3DvmuUgSRDbPT1fxz95Vd4xrmOuQiQ4prW36RNy39r5mdCvkYM7/rLXLfdI\nAqMZPf4awx3XaxyiOaA/6b4ddzTe1K42tNL6Y9gKfsdhCeQnqBPy6K3mpMaa\nRCxoWVz/tj/xpzGB8YwzKWKf56fDCsTBB9vHjUmB+9bl5Vg3TOrPn5/RAhUt\nFT3pGNkxnm1FDVblAlJZ16lBe5d+m78Pq8Ltg86NnDfd2FoBspNdh8Tksl3M\nzq8Q1ai3LyFolZJVVVZq48Ec/715wmYd2xe8jdYm2d2ZxOh/t/wF6K9M+Rxa\nN1ObmBCRrMcMb9vNGGLNU5kZKWxIeralyGRDsc/zdoAm0NBJYyBWU2W2BuKB\n+3a77VidzJmtWjI/nt2GHPIjmkevrCpLgkv4yFL1V3dmN3lG0h3mIkob0Ph6\nJCbtdS18vRuG28d3dRX/WgKYuQer2vXtF4q28v3M1wyX6LocjubRbqYNY00v\nLdzPfkA7IFdbFXZcM3zefVBDyGtlbwnKNYWtCc0Nsalijd/PH/zjaYTgOX9Q\nD8APbSyOjMfsvdj0OkuiCXfY+/ddHQ2/esiMo+vD4fSehO++/cSu8uu5oj+v\ntARuxGHymnt01ZvKkVyOSOKRnViCZNf10xcIgF8w/CvLtONnpUPcvcndndnZ\nJ5hghrcMu3+oRbkUxvDrUIk1vrB3F3kXdU9CP3s/q/Sk9e9tgm645GLQ2o6e\neNchT7J10Q742seZBfEiQOyPVwASLLQQRuOvnwdgYjKg0fXnN4mPRA8edyCM\nztt3EkX0OK6GJivPt5g/tjUqEkY/v6EISyxQRmMNMHlYlXUNIYzXLYLuKGtY\nl/HV9gFBzxm1ZPW+fR52VRGkhu2Kq2QA1ixtbX3hJSDxd8Y1ePhWFlQCH5zF\n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\nbX8A+SIRw880ZpcAAAAASUVORK5CYII=";

let img = document.createElement('img');
img.src = dataUri;

let canv = document.createElement('canvas');
canv.width = 128;
canv.height = 128;
let ctx = canv.getContext('2d');
ctx.drawImage(img, 0, 0, 128, 128, 0, 0, 128, 128);

let imgData = ctx.getImageData(0,0,128,128);
let imgDataData = imgData.data;
let allCharData = [];
for( let charCode=0; charCode<256; ++charCode ) {
	let sourceX = (charCode % 16)  * 8;
	let sourceY = Math.floor(charCode / 16) * 8;
	//let charDat = [0,0,0,0,0,0,0,0];
	for( let py=0; py<8; ++py ) {
		let rowDat = 0;
		for( let px=0; px<8; ++px ) {
			rowDat <<= 1;
			if( imgDataData[((sourceY+py)*128+(sourceX+px))*4+3] != 0 ) {
				rowDat |= 1;
			}
		}
		allCharData.push(rowDat);
		//charDat[py] = rowDat;
	}
	//allCharData[charCode] = charDat;
}

function hexDig(n) {
	switch(n) {
	case 0x0: return "0";
	case 0x1: return "1";
	case 0x2: return "2";
	case 0x3: return "3";
	case 0x4: return "4";
	case 0x5: return "5";
	case 0x6: return "6";
	case 0x7: return "7";
	case 0x8: return "8";
	case 0x9: return "9";
	case 0xA: return "A";
	case 0xB: return "B";
	case 0xC: return "C";
	case 0xD: return "D";
	case 0xE: return "E";
	case 0xF: return "F";
	default: throw new Error("Hex digit out of range: "+n);
	}
}

let hexCharCodes = [];
for( let c in allCharData ) {
	let rowData = allCharData[c];
	hexCharCodes.push( "0x"+hexDig(rowData >> 4)+hexDig(rowData & 0xF) );
}

let hexStr = hexCharCodes.join(',');

return hexStr;

})();
