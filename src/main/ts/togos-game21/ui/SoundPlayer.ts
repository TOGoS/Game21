import KeyedList from '../KeyedList';
import Datastore from '../Datastore';

export default class SoundPlayer {
	protected auctx?:AudioContext;
	protected loadedSounds:KeyedList<AudioBuffer> = {};
	protected loadingSounds:KeyedList<boolean> = {};
	
	public constructor(protected datastore:Datastore<Uint8Array>, auctx?:AudioContext) {
		if( auctx == undefined ) {
			if( typeof AudioContext != 'undefined' ) {
				auctx = new AudioContext();
			}
		}
		this.auctx = auctx;
	}
	
	public playSound(buf:AudioBuffer) {
		if( this.auctx ) {
			const source = this.auctx.createBufferSource();
			source.buffer = buf;
			source.connect(this.auctx.destination);
			source.start();
		}
	}
	
	public preloadSound(soundRef:string):void {
		if( this.loadingSounds[soundRef] ) return;
		this.loadingSounds[soundRef] = true;
		this.datastore.fetch( soundRef ).then( (buffer:Uint8Array) => {
			this.auctx.decodeAudioData(buffer.buffer).then( (aubuf:AudioBuffer) => {
				this.loadedSounds[soundRef] = aubuf;
				delete this.loadingSounds[soundRef];
			}, (err) => {
				console.error("Failed to load "+soundRef, err);
			});
		});
	}
	
	public playSoundByRef(soundRef:string, initiateFetch:boolean=false) {
		if( !this.auctx ) return;
		
		if( this.loadedSounds[soundRef] ) {
			this.playSound(this.loadedSounds[soundRef]);
		} else if( initiateFetch ) {
			this.preloadSound(soundRef);
		} else {
			console.error("Can't play sound "+soundRef+"; not loaded");
		}
	}
}
