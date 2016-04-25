import ShapeSheetUtil from './ShapeSheetUtil';
import TransformationMatrix3D from './TransformationMatrix3D';
import ObjectVisual, { VisualBasisType } from './ObjectVisual';
import ProceduralShape from './ProceduralShape';
import Rectangle from './Rectangle';
import Vector3D from './Vector3D';
import Quaternion from './Quaternion';
import { OnAnimationEnd } from './Animation';
import { DEFAULT_MATERIALS, IDENTITY_MATERIAL_REMAP } from './materials';
import CanvasWorldView from './CanvasWorldView';
import DemoWorldGenerator from './DemoWorldGenerator';
import { Game } from './world';

export default class MazeGame {
	protected _game:Game;
	public worldView:CanvasWorldView;
	public initUi(canvas:HTMLCanvasElement) {
		this.worldView = new CanvasWorldView();
		this.worldView.initUi(canvas);
		this.worldView.game = this._game;
	}
	
	get game():Game { return this._game; }
	set game(g:Game) {
		this._game = g;
		if( this.worldView ) this.worldView.game = g;
	}
	
	
	
	public runDemo() {
		this.game = new DemoWorldGenerator().makeCrappyGame();
		let roomId:string;
		for( roomId in this.game.rooms ); // Just find one; whatever.
		
		const animCallback = () => {
			let t = Date.now()/1000;
			this.worldView.clear();
			this.worldView.focusDistance = 16;
			this.worldView.drawScene(roomId, new Vector3D(Math.cos(t)*4, Math.sin(t*0.3)*4, this.worldView.focusDistance), 0);
			window.requestAnimationFrame(animCallback);
		};
		window.requestAnimationFrame(animCallback);
	}
}
