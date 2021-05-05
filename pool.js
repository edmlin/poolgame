"use strict";
if(typeof p2==='undefined')
{
	var p2=require('p2');
}
var	BALLRADIUS=0.0525/2,
	POCKETRADIUS=0.086/2,
	WALLTHICKNESS=BALLRADIUS*2,
	TABLELENGTH=2.7,
	TABLEWIDTH=TABLELENGTH/2,
	SCALE=250,
	BALLROWS=5,
	BALLCOUNT=(1+BALLROWS)*BALLROWS/2,
	BALLGROUP=Math.pow(2,0),
	RAYGROUP=Math.pow(2,1),
	BARGROUP=Math.pow(2,2),
	CUEGROUP=Math.pow(2,3),
	MAXPOWER=3,
	POWERCYCLE=2,
	SERVER='http://localhost:3000';
	
var App={
	world:new p2.World(),
	balls:[],
	ballSensors:[],
	wallShapes:[],
	wallBodies:[],
	bars:[],
	sensorBody:null,
	sensorBody1:null,
	floorBody:null,
	pockets:[],
	ray:new p2.Ray({mode:p2.Ray.CLOSEST,collisionGroup:RAYGROUP,collisionMask:BALLGROUP}),
	ballMaterial:new p2.Material(),
	barMateral:new p2.Material(),
	renderer:null,
	leftDown:false,
	rightDown:false,
	middleDown:false,
	raycastResult:new p2.RaycastResult(),
	mousePos:[],
	power:0,
	powerDirection:1,
	ballColors:['lightgray','yellow','blue','red','purple','orange','green','maroon','black','yellow','blue','red','purple','orange','green','maroon'],
	parked:[0,0],
	savedStatus:[],
	assistance:false,
	socket:null,
	uid:null,
	connected:false,
	aiming:false,
	practicing:true,
	movingCue:false,
	hits:0
};
App.main=function()
{
	this.init();
	//App.renderer.render(App.world);
	$("canvas").on("mousemove",this.mouseMove.bind(this));
	$("canvas").on("mousedown",this.mouseDown.bind(this));
	$("canvas").on("mouseup",this.mouseUp.bind(this));
	$("body").on("keydown",this.keyDown.bind(this));
	this.world.on("beginContact",this.beginContact.bind(this));
	this.world.on("endContact",this.endContact.bind(this));
	this.world.on("postStep",this.postStep.bind(this));
	$("#chat form").submit(this.chat.bind(this));
	this.initSocket();
	this.animate();
};

App.chat=function()
{
	var msg=$("#chat #message").val();
	$("#chat #message").val("");
	$("#chat #messages").prepend($('<li>').text(time()+" "+msg).addClass("sent"));
	this.sendAction("chat",msg);
	return false;
};

App.initSocket=function()
{
	this.socket=io(SERVER);
	this.socket.on("connected",function(data){
		this.uid=data.id;
		console.log(data);
		this.connected=true;
		this.sendAction("getstatus");
	}.bind(this));
	this.socket.on("disconnect",function(data){
		this.uid=null;
		console.log(data);
		this.connected=false;
	}.bind(this));
	this.socket.on("action",function(msg){
		console.log(msg);
		switch(msg.name)
		{
			case "impulse":
				this.balls[0].applyImpulse(msg.value);
				this.world.lines=[];
				break;
			case "aiming":
				if(!this.aiming)
				{
					this.power=0;
					this.aiming=true;
				}
				this.mousePos=msg.value;
				break;
			case "status":
				this.restoreStatus(msg.value);
				break;
			case "unaiming":
				this.aiming=false;
				this.world.lines=[];
				break;
			case "chat":
				$("#chat #messages").prepend($('<li>').text(time()+" "+msg.value).addClass("received"));
				break;
			case "getstatus":
				this.sendAction("status",this.getStatus());
				break;
			case "moving":
				this.balls[0].velocity=[0,0];
				this.balls[0].angularVelocity=0;
				this.balls[0].shapes[0].hidden=false;
				this.balls[0].position=p2.vec2.clone(msg.value);
				break;
		}
	}.bind(this));
};

App.beginContact=function(e)
{
	if((e.bodyA==this.sensorBody || e.bodyB==this.sensorBody) && e.bodyA!=this.balls[0] && e.bodyB!=this.balls[0])
	{
		this.sensorBody.hit=true;
	}
};

App.endContact=function(e)
{
	if((e.bodyA==this.sensorBody || e.bodyB==this.sensorBody) && e.bodyA!=this.balls[0] && e.bodyB!=this.balls[0])
	{
		this.sensorBody.hit=false;
	}
};

App.keyDown=function(e)
{
	if(this.practicing)
	{
		switch(e.keyCode)
		{
			case 8://backspace
				if(this.practicing && this.savedStatus.length>0) this.restoreStatus(this.savedStatus.pop());
				break;
			case 65://'a'
				this.assistance=!this.assistance;
				break;
		}
	}
	else
	{
		$("#message").focus();
	}
};

App.postStep=function()
{
	for(var i=0;i<this.balls.length;i++)
	{
		for(var j=0;j<this.pockets.length;j++)
		{
			if(distance(this.balls[i].interpolatedPosition,this.pockets[j].position)<=POCKETRADIUS)
			{
				if(i===0)
				{
					this.balls[0].shapes[0].hidden=true;
				}
				else
				{
					//this.world.removeBody(this.balls[i]);
					//this.balls[i].shapes[0].hidden=true;
					this.park(i);
				}
				break;
			}
		}
	}
	if(this.aiming && !this.balls[0].shapes[0].hidden)
	{
		this.aimTo(this.mousePos);
	}
};

App.park=function(i)
{
	if(this.balls[i].parked) return;
	var park0=[-TABLELENGTH/2,-TABLEWIDTH/2-POCKETRADIUS*5],park1=[TABLELENGTH/2,-TABLEWIDTH/2-POCKETRADIUS*5];
	if(i<=8)
	{
		this.balls[i].position=[park0[0]+BALLRADIUS+this.parked[0]*BALLRADIUS*2.1,park0[1]];
		this.balls[i].velocity=[0,0];
		this.parked[0]++;
	}
	else
	{
		this.balls[i].position=[park1[0]-BALLRADIUS-this.parked[1]*BALLRADIUS*2.1,park1[1]];
		this.balls[i].velocity=[0,0];
		this.parked[1]++;
	}
	this.balls[i].parked=true;
};

App.initPockets=function()
{
	var pocketPositions=[
		[-TABLELENGTH/2-POCKETRADIUS/2,TABLEWIDTH/2+POCKETRADIUS/2],
		[0,TABLEWIDTH/2+POCKETRADIUS],
		[TABLELENGTH/2+POCKETRADIUS/2,TABLEWIDTH/2+POCKETRADIUS/2],
		[-TABLELENGTH/2-POCKETRADIUS/2,-TABLEWIDTH/2-POCKETRADIUS/2],
		[0,-TABLEWIDTH/2-POCKETRADIUS],
		[TABLELENGTH/2+POCKETRADIUS/2,-TABLEWIDTH/2-POCKETRADIUS/2]
		];
	for(let i=0;i<6;i++)
	{
		var pocketShape=new p2.Circle({radius:POCKETRADIUS,sensor:true});
		pocketShape.color='black';
		var pocketBody=new p2.Body({position:pocketPositions[i]});
		pocketBody.addShape(pocketShape);
		this.pockets.push(pocketBody);
		this.world.addBody(pocketBody);
	}
};

App.initTable=function()
{
	var pockets=this.pockets;
	var vertices=[];
	vertices[0]=[
	[pockets[0].position[0]+POCKETRADIUS/Math.sqrt(2),pockets[0].position[1]+POCKETRADIUS/Math.sqrt(2)],
	[pockets[0].position[0]+POCKETRADIUS/Math.sqrt(2)+pockets[0].position[1]+POCKETRADIUS/Math.sqrt(2)-TABLEWIDTH/2,TABLEWIDTH/2],
	[-POCKETRADIUS/Math.tan(Math.PI/8),TABLEWIDTH/2],
	[pockets[1].position[0]-POCKETRADIUS,pockets[0].position[1]+POCKETRADIUS/Math.sqrt(2)]
	];
	vertices[1]=[];vertices[2]=[];vertices[3]=[];vertices[4]=[];vertices[5]=[]
	vertices[4]=[
	[-vertices[0][0][1]-TABLELENGTH/4,-vertices[0][0][0]-TABLEWIDTH/2],
	[-vertices[0][0][1]-TABLELENGTH/4,vertices[0][0][0]+TABLEWIDTH/2],
	[-vertices[0][1][1]-TABLELENGTH/4,+vertices[0][1][0]+TABLEWIDTH/2],
	[-vertices[0][1][1]-TABLELENGTH/4,-vertices[0][1][0]-TABLEWIDTH/2]
	];
	for(let i=0;i<vertices[0].length;i++)
	{
		vertices[1][i]=[];
		p2.vec2.mul(vertices[1][i],vertices[0][i],[1,-1]);
		vertices[2][i]=[];
		p2.vec2.mul(vertices[2][i],vertices[0][i],[-1,1]);
		vertices[3][i]=[];
		p2.vec2.mul(vertices[3][i],vertices[0][i],[-1,-1]);
		vertices[5][i]=[];
		p2.vec2.mul(vertices[5][i],vertices[4][i],[-1,1]);
	}
	vertices[1].reverse();
	vertices[2].reverse();
	vertices[5].reverse();
	for(let i=0;i<vertices.length;i++)
	{
		var barShape=new p2.Convex({vertices:vertices[i],collisionGroup:BARGROUP,collisionMask:BALLGROUP|CUEGROUP,material:this.barMateral});
		barShape.color='darkgreen';
		var barBody=new p2.Body();
		barBody.addShape(barShape);
		this.world.addBody(barBody);
		this.bars.push(barBody);
	}
	var floorShape=new p2.Box({position:[0,0],width:2*(vertices[0][0][1]+TABLELENGTH/4),height:2*(pockets[0].position[1]+POCKETRADIUS/Math.sqrt(2)),sensor:true});
	floorShape.color='lightgreen';
	this.floorBody=new p2.Body();
	this.floorBody.addShape(floorShape);
	this.world.bodies.unshift(this.floorBody);
	var tableShape=new p2.Box({position:[0,0],width:-2*(pockets[0].position[0]-POCKETRADIUS*3),height:2*(pockets[0].position[1]+POCKETRADIUS*3),sensor:true});
	tableShape.color='#4A2106';
	var tableBody=new p2.Body();
	tableBody.addShape(tableShape);
	this.world.bodies.unshift(tableBody);
};

App.initBalls=function()
{
	var balls=this.balls;
	for(let i=0;i<BALLCOUNT+1;i++)
	{
		var ballShape=new p2.Circle({radius:BALLRADIUS,material:this.ballMaterial,collisionGroup:BALLGROUP,collisionMask:RAYGROUP|BALLGROUP|BARGROUP|CUEGROUP});
		ballShape.color=this.ballColors[i];
		ballShape.hidden=false;
		var ballBody=new p2.Body({mass:1,damping:0.2});
		ballBody.addShape(ballShape);
		if(i>0)
		{
			var ballSensorShape=new p2.Circle({radius:BALLRADIUS*2,sensor:true,collisionGroup:BALLGROUP,collisionMask:RAYGROUP});
			ballSensorShape.hidden=true;
			ballBody.addShape(ballSensorShape);
		}
		balls.push(ballBody);
		this.world.addBody(ballBody);
	}
	balls[0].shapes[0].collisionGroup=CUEGROUP;
	balls[0].shapes[0].collisionMask=BALLGROUP|BARGROUP;
	var initX=-TABLELENGTH/4,initY=0;
	balls[0].position[0]=-initX;
	balls[0].position[1]=initY;
	
	var positions=this.balls.slice(1);
	
	shuffle(positions);
	if(positions[4]!=this.balls[8])
	{
		let i=positions.indexOf(this.balls[8]);
		positions[i]=positions[4];
		positions[4]=this.balls[8];
	}
	
	if(this.balls.indexOf(positions[14])>8 && this.balls.indexOf(positions[10])>8)
	{
		let i=Math.floor(Math.random()*6)+1;
		let j=positions.indexOf(this.balls[i]);
		positions[j]=positions[10];
		positions[10]=this.balls[i];
	}
	else if(this.balls.indexOf(positions[14])<8 && this.balls.indexOf(positions[10])<8)
	{
		let i=Math.floor(Math.random()*6)+9;
		let j=positions.indexOf(this.balls[i]);
		positions[j]=positions[10];
		positions[10]=this.balls[i];
	}
	
	//var ballIndex=1;
	var ballIndex=0;
	for(let col=0;col<BALLROWS;col++)
	{
		for(let row=0;row<=col;row++)
		{
			//balls[ballIndex].position[0]=initX-col*BALLRADIUS*Math.sqrt(3);
			//balls[ballIndex].position[1]=initY+col*BALLRADIUS-row*BALLRADIUS*2;
			positions[ballIndex].position[0]=initX-col*BALLRADIUS*Math.sqrt(3);
			positions[ballIndex].position[1]=initY+col*BALLRADIUS-row*BALLRADIUS*2;
			ballIndex++;
		}
	}
};

App.init=function()
{
	this.renderer=new Renderer(document.getElementById("canvas"),SCALE);
	this.world = new p2.World();
	this.world.gravity[1]=0;
	
	this.initPockets();
	this.initBalls();
	this.initTable();
	
	var sensorShape=new p2.Circle({radius:BALLRADIUS,material:this.ballMaterial,sensor:true,collisionGroup:CUEGROUP,collisionMask:BALLGROUP|BARGROUP});
	sensorShape.hidden=true;
	this.sensorBody=new p2.Body({mass:1});
	this.sensorBody.position=p2.vec2.clone(this.balls[0].position);
	this.sensorBody.addShape(sensorShape);
	this.sensorBody.hit=false;

	var sensorShape1=new p2.Circle({radius:BALLRADIUS,material:this.ballMaterial,sensor:true});
	sensorShape1.hidden=true;
	this.sensorBody1=new p2.Body({mass:1,position:[0,0]});
	this.sensorBody1.addShape(sensorShape1);
	
	this.world.addBody(this.sensorBody);
	this.world.addBody(this.sensorBody1);
	this.world.addContactMaterial(new p2.ContactMaterial(this.ballMaterial, this.ballMaterial, {
	restitution: 0.8,
	stiffness: Number.MAX_VALUE // We need infinite stiffness to get exact restitution
	}));
	this.world.addContactMaterial(new p2.ContactMaterial(this.ballMaterial, this.barMateral, {
	restitution: 0.8,
	stiffness: Number.MAX_VALUE // We need infinite stiffness to get exact restitution
	}));

	this.world.lines=[];
	this.parked=[0,0];
};

// Animation loop
App.animate=function(time)
{
	requestAnimationFrame(this.animate.bind(this));
	var timeStep = 1 / 60  , maxSubSteps = 5;
	var dt = this.lastTime ? (time - this.lastTime) / 1000 : 0;
	var dt1 = this.lastTime ? (time - this.lastTime) / 1000 : 0;
	dt = Math.min(1 / 10, dt);
	this.lastTime = time;
	// Move physics bodies forward in time
	this.world.step(timeStep/3, dt, maxSubSteps);
	this.world.step(timeStep/3, dt, maxSubSteps);
	this.world.step(timeStep/3, dt, maxSubSteps);
	for(let i=1;i<this.balls.length;i++) this.sensorBody.hit=this.sensorBody.hit||this.sensorBody.overlaps(this.balls[i]);
	if(!this.sensorBody.hit && this.movingCue && !same(this.sensorBody.position,this.balls[0].position))
	{
		this.balls[0].position=this.sensorBody.position.slice(0);
		this.balls[0].velocity=[0,0];
		this.balls[0].angularVelocity=0;
		this.balls[0].shapes[0].hidden=false;
		this.sendAction("moving",this.balls[0].position);
	}
	// Render scene
	this.renderer.render(this.world);
	for(let i=0;i<this.balls.length;i++)
	{
		if(this.balls[i].shapes[0].hidden) continue;
		if(i<=8)
			this.renderer.drawBallPhy(this.balls[i].interpolatedPosition[0],this.balls[i].interpolatedPosition[1],BALLRADIUS,this.balls[i].interpolatedAngle,this.balls[i].shapes[0].color);
		else
			this.renderer.drawStripeBallPhy(this.balls[i].interpolatedPosition[0],this.balls[i].interpolatedPosition[1],BALLRADIUS,this.balls[i].interpolatedAngle,this.balls[i].shapes[0].color);
	}
	if(this.aiming && !this.balls[0].shapes[0].hidden)
	{
		var powerStep=MAXPOWER/POWERCYCLE*dt;
		if(this.power>=MAXPOWER)
		{
			this.powerDirection=-1;
		}
		if(this.power<=0) 
		{
			this.powerDirection=1;
		}
		this.power+=powerStep*this.powerDirection;
		this.drawPower(this.power);
	}
};

App.drawPower=function(power)
{
	var ctx=this.renderer.ctx;
	var gradient=ctx.createLinearGradient(0,0,this.renderer.w,0);
	gradient.addColorStop(0,"green");
	gradient.addColorStop(0.5,"yellow");
	gradient.addColorStop(1,"red");
	ctx.fillStyle=gradient;
	ctx.fillRect(0,this.renderer.h-20,this.renderer.w*this.power/MAXPOWER,this.renderer.h);
};
App.mouseDown=function(e)
{
	this.sendAction("status",this.getStatus());
	if(e.which==1)
	{
		this.leftDown=true;
		
		this.mousePos=this.renderer.view2Phy([e.pageX,e.pageY]);
		if(this.balls[0].shapes[0].hidden || distance(this.mousePos,this.balls[0].position)<BALLRADIUS)
		{
			this.movingCue=true;
			$(this.renderer.canvas).css('cursor','pointer');
		}
		else
		{
			if(this.balls[0].shapes[0].hidden) return;
			this.aiming=true;
			this.power=0;
			this.mouseMove(e);
			$(this.renderer.canvas).css('cursor','none');
		}
		this.mouseMove(e);
	}
	if(e.which==2)
	{
		this.middleDown=true;
		this.aiming=true;
		if(this.balls[0].shapes[0].hidden) return;
		this.power=0;
		this.mouseMove(e);
		$(this.renderer.canvas).css('cursor','none');
	}
	if(e.which==3)
	{
		this.rightDown=true;
	}
};
App.mouseUp=function(e)
{
	this.sendAction("status",this.getStatus());
	if(e.which==1)
	{
		this.leftDown=false;
		this.movingCue=false;
		$(this.renderer.canvas).css('cursor','auto');
		if(this.aiming)
		{
			this.aiming=false;
			this.sendAction("unaiming");
			this.sensorBody1.shapes[0].hidden=true;
			var l=this.world.lines[0];
			if(l.points.length>1 && distance(l.points[0],l.points[1])>=BALLRADIUS)
			{
				if(this.practicing) this.savedStatus.push(this.getStatus());
				//this.balls[0].applyImpulse([(l.points[1][0]-l.points[0][0])*5,(l.points[1][1]-l.points[0][1])*5]);
				var dy=(l.points[1][1]-l.points[0][1])/distance(l.points[0],l.points[1]);
				var dx=(l.points[1][0]-l.points[0][0])/distance(l.points[0],l.points[1]);
				this.balls[0].applyImpulse([this.power*dx,this.power*dy]);
				this.increaseHits();
				this.sendAction("impulse",[this.power*dx,this.power*dy]);
				//console.log("Force: "+ (this.power*dx) +", "+(this.power*dy) );
			}
			this.world.lines=[];
		}
	}
	if(e.which==2)
	{
		this.middleDown=false;
		this.aiming=false;
		this.sendAction("unaiming");
		if(this.balls[0].shapes[0].hidden) return;
		$(this.renderer.canvas).css('cursor','auto');
		this.sensorBody1.shapes[0].hidden=true;
		var l=this.world.lines[0];
		if(l.points.length>1 && distance(l.points[0],l.points[1])>=BALLRADIUS)
		{
			if(this.practicing) this.savedStatus.push(this.getStatus());
			//this.balls[0].applyImpulse([(l.points[1][0]-l.points[0][0])*5,(l.points[1][1]-l.points[0][1])*5]);
			var dy=(l.points[1][1]-l.points[0][1])/distance(l.points[0],l.points[1]);
			var dx=(l.points[1][0]-l.points[0][0])/distance(l.points[0],l.points[1]);
			this.balls[0].applyImpulse([this.power*dx,this.power*dy]);
			this.increaseHits();
			this.sendAction("impulse",[this.power*dx,this.power*dy]);
			//console.log("Force: "+ (this.power*dx) +", "+(this.power*dy) );
		}
		this.world.lines=[];
	}
	if(e.which==3)
	{
		this.rightDown=false;
	}
};

App.mouseMove=function(e)
{
	this.mousePos=this.renderer.view2Phy([e.pageX,e.pageY]);
	if(e.which==1)
	{
		if(this.movingCue)
		{
			var pos=this.mousePos;
			if(this.world.hitTest(pos,[this.floorBody],1).length==0) return;
			this.sensorBody.position=pos;
		}
		else
		{
			this.sendAction("aiming",this.mousePos);
		}
	}
	if(e.which==2)
	{
		//var point0=this.renderer.view2Phy([e.pageX,e.pageY]);
		//this.aimTo(point0);
		this.sendAction("aiming",this.mousePos);
	}
	if(e.which==3)
	{
	}
};

App.aimTo=function(point1)
{
	var point0=this.balls[0].interpolatedPosition;
	this.world.lines=[];
	this.world.lines.push({color:"gray",points:[point0,point1]});
	if(this.assistance)
	{
		this.ray.from=p2.vec2.clone(point0);
		this.ray.to=p2.vec2.clone(point1);
		this.ray.update();
		this.raycastResult.reset();
		this.world.raycast(this.raycastResult,this.ray);
		var hit=[];
		this.raycastResult.getHitPoint(hit,this.ray);
		if(this.raycastResult.hasHit())
		{
			this.sensorBody1.position=hit;
			this.sensorBody1.shapes[0].hidden=false;
			let p=this.raycastResult.body.position;
			this.world.lines.push({color:"gray",points:[p,[(p[0]-hit[0])*10+hit[0],(p[1]-hit[1])*10+hit[1]]]});
		}
		else
		{
			this.sensorBody1.position=point1;
			this.sensorBody1.shapes[0].hidden=true;
		}
	}
	else
	{
		this.sensorBody1.shapes[0].hidden=true;
	}
};

App.aimFrom=function(point0)
{
	var	point1=this.balls[0].interpolatedPosition,
		point2=[];
	this.world.lines=[];
	this.world.lines.push({color:"silver",points:[point0,point1]});

	if(point0[1]<point1[1])
	{
		point2[1]=TABLEWIDTH/2;
	}
	else if(point0[1]>point1[1])
	{
		point2[1]=-TABLEWIDTH/2;
	}
	else
	{
		point2[1]=point0[1];
	}
	//console.log(point0[1]+','+point1[1]);
	if(point0[1]!=point1[1])
	{
		var dx = (point0[0]-point1[0]) / (point0[1]-point1[1]) * (point1[1]-point2[1]);
		point2[0]=point1[0]-dx;
	}
	else
	{
		if(point0[0]>point1[0])
		{
			point2[0]=-TABLELENGTH/2;
		}
		else
		{
			point2[0]=TABLELENGTH/2;
		}
	}
	p2.vec2.copy(this.ray.from,point1);
	p2.vec2.copy(this.ray.to,point2);
	this.ray.update();
	this.raycastResult.reset();
	this.world.raycast(this.raycastResult,this.ray);
	var hit=[];
	this.raycastResult.getHitPoint(hit,this.ray);
	if(this.raycastResult.hasHit())
	{
		this.world.lines[0].points.push(hit);
	}
	else
	{
		this.world.lines[0].points.push(point2);
	}
};

App.getStatus=function()
{
	var status={balls:[],parked:[]};
	for(let i=0;i<this.balls.length;i++)
	{
		status.balls[i]={};
		status.balls[i].position=p2.vec2.clone(this.balls[i].position);
		status.balls[i].velocity=p2.vec2.clone(this.balls[i].velocity);
		status.balls[i].angularVelocity=this.balls[i].angularVelocity;
		status.balls[i].parked=this.balls[i].parked;
	}
	status.parked=p2.vec2.clone(this.parked);
	return status;
};

App.restoreStatus=function(status)
{
	if(status.balls.length<=0) return;
	for(let i=0;i<this.balls.length;i++)
	{
		this.balls[i].position=p2.vec2.clone(status.balls[i].position);
		this.balls[i].velocity=p2.vec2.clone(status.balls[i].velocity);
		this.balls[i].angularVelocity=status.balls[i].angularVelocity;
		this.balls[i].parked=status.balls[i].parked;
	}
	this.parked=p2.vec2.clone(status.parked);
	this.balls[0].shapes[0].hidden=false;
};

App.sendAction=function(name,value)
{
	if(!this.connected) return;
	this.socket.emit("action",{name:name,value:value});
};

App.increaseHits=function()
{
	this.hits++;
	$("#hits").text(this.hits);
};

function makeColor(r,g,b)
{
  return "rgb("+r+","+g+","+b+")";
}

function distance(point1,point2)
{
	return Math.sqrt(Math.pow(point1[0]-point2[0],2)+Math.pow(point1[1]-point2[1],2));
}

function shuffle(array) {
    let counter = array.length;

    // While there are elements in the array
    while (counter > 0) {
        // Pick a random index
        let index = Math.floor(Math.random() * counter);

        // Decrease counter by 1
        counter--;

        // And swap the last element with it
        let temp = array[counter];
        array[counter] = array[index];
        array[index] = temp;
    }

    return array;
}

function time()
{
	var d=new Date();
	return ('0'+d.getHours()).slice(-2) + ":" + ('0' + d.getMinutes()).slice(-2) + ":" + ('0'+d.getSeconds()).slice(-2);
}

function same(p1,p2)
{
	return (p1[0]==p2[0] && p1[1]==p2[1]);
}

if(typeof exports!=='undefined') exports.App=App;