export default class ShapeSheetEditor
{
	protected _primaryCcanvas:HTMLCanvasElement;
	
	public initUi():void {
		this._primaryCcanvas = <HTMLCanvasElement>document.getElementById('primary-canvas');
	}
}
