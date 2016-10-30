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
	
	public playSound(buf:AudioBuffer, volume?:number) {
		if( this.auctx ) {
			if( volume == undefined ) volume = 1;
			const source = this.auctx.createBufferSource();
			source.buffer = buf;
			const gain:GainNode = this.auctx.createGain();
			gain.gain.value = volume;
			source.connect(gain);
			gain.connect(this.auctx.destination);
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
	
	public playSoundByRef(soundRef:string, volume:number|undefined) {
		if( !this.auctx ) return;
		
		if( this.loadedSounds[soundRef] ) {
			this.playSound(this.loadedSounds[soundRef], volume);
		} else {
			console.error("Can't play sound "+soundRef+"; not loaded");
		}
	}
}
