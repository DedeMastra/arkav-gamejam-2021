import { Assets } from "../../../library/AssetGameplay";
import { BaseView } from "../../../modules/core/BaseView";
import { ArcadeSprite } from "../../../modules/gameobjects/ArcadeSprite";
import { ScreenUtilController } from "../../../modules/screenutility/ScreenUtilController";

export const enum DataProps {
	deactiveThreshold = "deactiveThreshold",
	displayPercentage = "displayPercentage",
	backgroundEdges = "backgroundEdges",
	assetType = "assetType",
}

export const enum EventNames {
	onSpawn = "onSpawn",
	onTap = "onTap",
};

export class ObstacleView implements BaseView {

	event: Phaser.Events.EventEmitter;
	screenUtility: ScreenUtilController;

	props = {
		timeToSpawn: 1000
	};

	private _maxTimeToSpawn: number;
	private _obstacleGroup: Phaser.Physics.Arcade.Group;
	private _emitter: Phaser.GameObjects.Particles.ParticleEmitter;
	public obsHoldCondition: boolean = false;
	public obsHoldCounter: number;
	private _deactivatedStreak: string[] = [];
	public deactivatedBonus: boolean;

	constructor (private _scene: Phaser.Scene) {
		this.screenUtility = ScreenUtilController.getInstance();
		this.event = new Phaser.Events.EventEmitter();
		this._maxTimeToSpawn = 1000;
	}

	get obstacles (): Phaser.Physics.Arcade.Group {
		return this._obstacleGroup;
	}

	get maxTimeToSpawn (): number {
		return this._maxTimeToSpawn;
	}

	private getAssetTypeKey (): string {
		const assetKeys = [ // TODO: Define with object data property
			Assets.obs_boulder.key,
			Assets.obs_plank.key,
			// Assets.obs_sharp.key,
			Assets.obs_hold.key,
		];
		const randomPick = Math.floor(Math.random() * assetKeys.length);
		return assetKeys[randomPick];
	}

	private setInteractive (gameObject: Phaser.Physics.Arcade.Sprite): void {
		gameObject.setInteractive({ useHandCursor: true });

		const assetType = gameObject.getData(DataProps.assetType) as string;
		const dataProps = {
			counter: "counter"
		};
		switch (assetType) {
		case Assets.obs_boulder.key:
			gameObject.on("pointerup", () => {
				let prevCounter: number = gameObject.getData(dataProps.counter) ?? 0;
				if (++prevCounter >= 3) {
					gameObject.setData(dataProps.counter, 0);
					this.playParticle(gameObject);
					this.deactiveGameObject(gameObject, true);
					return;
				}
				gameObject.setData(dataProps.counter, prevCounter);
			});
			break;
		case Assets.obs_plank.key:
			const inputPlugin = this._scene.input;
			inputPlugin.setDraggable(gameObject);
			inputPlugin.dragDistanceThreshold = 32 * gameObject.getData(DataProps.displayPercentage);
			let initGameObjectX = gameObject.x;

			//gameObject.on("dragstart", () => gameObject.setVelocity(0));
			gameObject.on("drag", (p: Phaser.Input.Pointer, dragX: number) => {
				let direction = initGameObjectX - dragX;
				// if(direction >= 0){
					gameObject.x -= direction/210;
					// kalau pakai dragX angkanya jadi kekecilan, jadinya lambat banget gerak
					// console.log('ke kiriii');
				// } else {
					// gameObject.x -= direction/210;
					// gak tahu kenapa minus juga
					// console.log('ke kanann');
				// }
				// i don't know what i'm doing but it works!
			});
			gameObject.on("dragend", () => {
				// gameObject.disableInteractive();
				this._scene.tweens.add({
					targets: gameObject,
					alpha: 1,
					duration: 100,
					// onComplete: () => {
					// 	this.deactiveGameObject(gameObject);
					// 	gameObject.setAlpha(1);
					// }
				});
			});
			break;
		case Assets.obs_hold.key:
			gameObject.on("pointerdown", () => {
				this.obsHoldCondition = true;
				gameObject.on("pointerup", () => {
					if(this.obsHoldCounter >= 50){
						this.deactiveGameObject(gameObject, true);
						console.log('Game Object deactivated');
					}
					this.obsHoldCondition = false;
					this.obsHoldCounter = 0;
				});
			});
			break;
		default:
			gameObject.once("pointerup", () => {
				this.playParticle(gameObject);
				this.deactiveGameObject(gameObject, true);
			});
			break;
		}
	}

	private spawnObstacle (displayPercentage: number, edges: number[], assetType: string): void {
		const [leftEdge, rightEdge, topEdge, bottomEdge] = edges;
		const spawnPosY = bottomEdge;
		const speedRelative = -230;

		const obstacle = new ArcadeSprite(this._scene, 0, 0, assetType, 0);
		this._obstacleGroup.add(obstacle.gameObject);

		obstacle.transform.setToScaleDisplaySize(displayPercentage);
		obstacle.gameObject.setData(DataProps.assetType, assetType);
		obstacle.gameObject.setData(DataProps.displayPercentage, displayPercentage);
		obstacle.gameObject.setData(DataProps.backgroundEdges, edges);
		obstacle.gameObject.setData(DataProps.deactiveThreshold, topEdge - (obstacle.transform.displayHeight / 2));

		obstacle.gameObject.setPosition(
			Phaser.Math.Between(leftEdge + (obstacle.transform.displayWidth / 2), rightEdge - (obstacle.transform.displayWidth / 2)),
			spawnPosY + (obstacle.transform.displayHeight / 2)
		);
		obstacle.gameObject.setVelocityY(speedRelative * displayPercentage);

		this.setInteractive(obstacle.gameObject);
	}

	private reuseObstacle (gameObject: Phaser.Physics.Arcade.Sprite): void {
		gameObject.setActive(true);
		gameObject.enableBody(false, 0, 0, true, true);

		const [left, right, top, bottom] = gameObject.getData(DataProps.backgroundEdges) as number[];
		gameObject.setPosition(
			Phaser.Math.Between(left + (gameObject.displayWidth / 2), right - (gameObject.displayWidth / 2)),
			bottom + (gameObject.displayHeight / 2)
		);

		const speedRelative = -280;
		const displayPercentage = gameObject.getData(DataProps.displayPercentage) as number;
		gameObject.setVelocityY(speedRelative * displayPercentage);

		this.setInteractive(gameObject);
	}

	private createParticleEmitter (): void {
		this._emitter = this._scene.add.particles(Assets.white_effect.key).createEmitter({
			scale: { start: 1, end: 0 },
			speed: { min: 0, max: 240 },
			angle: 270,
			gravityY: -98,
			active: false,
			lifespan: 550,
			quantity: 50
		});
	}

	private playParticle (gameObject: Phaser.Physics.Arcade.Sprite): void {
		const { displayWidth: width, displayHeight: height } = gameObject;
		const { x, y } = gameObject.getTopLeft();
		const ratio = gameObject.getData(DataProps.displayPercentage) as number;
		const count = 45 * ratio;

		this._emitter.active = true;
		this._emitter.setEmitZone({
			source: new Phaser.Geom.Rectangle(0, 0, (width), (height)),
			quantity: count,
			type: "random"
		});
		this._emitter.explode(count, x, y);
	}

	deactiveGameObject (gameObject: Phaser.Physics.Arcade.Sprite, playerDo: boolean): void {
		if(!this._deactivatedStreak.length){
			this._deactivatedStreak.push(gameObject.texture.key);
			console.log('demi bonus', gameObject.texture.key, 'first');
		} else {
			if(playerDo){
				if(this._deactivatedStreak[0] == gameObject.texture.key) {
					this._deactivatedStreak.push(gameObject.texture.key);
					console.log('demi bonus', gameObject.texture.key, 'it is the same!', this._deactivatedStreak.length);

					if(this._deactivatedStreak.length >= 4){
						this.deactivatedBonus = true;
						this._deactivatedStreak.length = 0;
						console.log('demi bonus', 'berhasil dapet 4x')
					}
				} else {
					this._deactivatedStreak.length = 0;
					console.log('demi bonus', gameObject.texture.key, 'it is different');
				}
			}
		}
		
		gameObject.setVelocity(0).disableBody(true, true);
		gameObject.removeAllListeners();
		gameObject.setActive(false);
	}

	create (displayPercentage: number, edges: number[]): void {
		this._obstacleGroup = this._scene.physics.add.group();
		this.createParticleEmitter();
		this.event.on(EventNames.onSpawn, () => {
			const assetType = this.getAssetTypeKey();
			const obstacle = this._obstacleGroup.getChildren()
				.find((obstacle) => !obstacle.active && (obstacle.getData(DataProps.assetType) === assetType));
			if (obstacle) {
				this.reuseObstacle(obstacle as Phaser.Physics.Arcade.Sprite);
				return;
			}
			this.spawnObstacle(displayPercentage, edges, assetType);
		});
	}

}
