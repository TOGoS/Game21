import ImageSlice from './ImageSlice';

export const EMPTY_IMAGE_URL = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';

export function imageFromUrl(srcRef:string):HTMLImageElement {
    const img = <HTMLImageElement>document.createElement('img');
    img.src = srcRef;
    return img;
}

export const EMPTY_IMAGE:HTMLImageElement = imageFromUrl(EMPTY_IMAGE_URL);

export const EMPTY_IMAGE_SLICE = {
    bounds: {
        minX: 0, minY: 0, minZ: 0,
        maxX: 1, maxY: 1, maxZ: 0,
    },
    origin: {x:0, y:0, z:0},
    sheetRef: EMPTY_IMAGE_URL,
    sheet: EMPTY_IMAGE
};
