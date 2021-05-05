var Renderer=function(canvas,scale)
{
	this.canvas=canvas;
	this.w=canvas.width;
	this.h=canvas.height;
	this.ctx=canvas.getContext('2d');
	this.ctx.lineWidth = 1/scale;
	this.scale=scale;
};
Renderer.prototype.render=function(world)
{
	this.clear();
	this.ctx.save();
	this.scaleView(this.scale);
	// Draw all bodies
	for(let i=0;i<world.bodies.length;i++)
	{
		this.drawBody(world.bodies[i]);
	}
	for(let i=0;i<world.lines.length;i++)
	{
		this.drawLine(world.lines[i]);
	}
	// Restore transform
	this.ctx.restore();
};
Renderer.prototype.clear=function()
{
	this.ctx.clearRect(0,0,this.w,this.h);
};
Renderer.prototype.scaleView=function(s)
{
	// Transform the canvas
	// Note that we need to flip the y axis since Canvas pixel coordinates
	// goes from top to bottom, while physics does the opposite.
	this.ctx.translate(this.w/2, this.h/2);  // Translate to the center
	this.ctx.scale(s, -s);       // Zoom in and flip y axis
};

Renderer.prototype.drawBody=function(b)
{
  this.ctx.save();
  var x=b.interpolatedPosition[0],y=b.interpolatedPosition[1],a=b.interpolatedAngle;
  this.ctx.translate(x,y);
  this.ctx.rotate(a);
  for(var i=0;i<b.shapes.length;i++)
  {
      this.drawShape(b.shapes[i]);
  }
  this.ctx.restore();
};

Renderer.prototype.drawShapeAngle=function(s)
{
	var ctx=this.ctx;
	switch(s.type)
	{
		case p2.Shape.CIRCLE:
			var x = s.position[0],
				y = s.position[1],
				radius = s.radius;
			ctx.moveTo(x,y);
			ctx.lineTo(x+radius,y);
			break;
	}
};

Renderer.prototype.drawShape=function(s)
{
  if(s.hidden) return;
  var ctx=this.ctx;

  this.ctx.save();
  var x=s.position[0],y=s.position[1],a=s.angle;
  this.ctx.translate(x,y);
  this.ctx.rotate(a);
  if(s.sensor)
  {
	ctx.setLineDash([1/this.scale*2,1/this.scale*2]);
	ctx.strokeStyle='gray';
  }
  else
  {
	ctx.setLineDash([]);
	ctx.strokeStyle='black';
  }
  switch(s.type)
  {
    case p2.Shape.CIRCLE:
		ctx.beginPath();
		var	radius = s.radius;
		ctx.arc(0,0,radius,0,2*Math.PI);
		//this.drawShapeAngle(s);
		break;
	case p2.Shape.PLANE:
		ctx.beginPath();
        ctx.moveTo(-this.w, 0);
        ctx.lineTo( this.w, 0);
		break;
	case p2.Shape.LINE:
		ctx.beginPath();
        ctx.moveTo(-this.w, 0);
        ctx.lineTo( this.w, 0);
		break;
	case p2.Shape.CONVEX:
		ctx.beginPath();
		ctx.moveTo(s.vertices[0][0],s.vertices[0][1]);
		for(var i=1;i<s.vertices.length;i++)
		{
			ctx.lineTo(s.vertices[i][0],s.vertices[i][1]);
		}
		ctx.lineTo(s.vertices[0][0],s.vertices[0][1]);
		break;
  }
  if(s.color!==undefined)
  {
	ctx.fillStyle=s.color;
	//ctx.strokeStyle=s.color;
	//ctx.strokeStyle='gray';
  	ctx.fill();
  }
  ctx.stroke();
  ctx.restore();
};

Renderer.prototype.drawBallPhy=function(x,y,r,angle,color,text)
{
	var ctx=this.ctx;
	ctx.save();
	this.scaleView(this.scale);
	ctx.translate(x,y);
	ctx.beginPath();
	ctx.arc(0,0,r,0,Math.PI*2);
	let gradient=ctx.createRadialGradient(r/2,r/2,r,r/2,r/2,0);
	gradient.addColorStop(0,color);
	gradient.addColorStop(1,"white");
	ctx.fillStyle=gradient;
	ctx.strokeStyle='gray';
	ctx.fill();
	ctx.stroke();
	ctx.restore();
	if(text!==undefined)
	{
		ctx.save();
		ctx.translate(x*this.scale+this.w/2,this.h/2-y*this.scale);
		ctx.beginPath();
		ctx.arc(0,0,r/3*this.scale,0,Math.PI*2);
		ctx.fillStyle="white";
		ctx.fill();
		ctx.rotate(-angle);
		ctx.textBaseline="middle";
		ctx.textAlign="center";
		ctx.font="bold 8px sans-serif";
		ctx.fillStyle="black";
		ctx.fillText(text,0,0);
		ctx.restore();
	}
};

Renderer.prototype.drawStripeBallPhy=function(x,y,r,angle,color,text)
{
	var ctx=this.ctx;
	ctx.save();
	this.scaleView(this.scale);
	ctx.translate(x,y);
	ctx.beginPath();
	ctx.arc(0,0,r,0,Math.PI*2);
	let gradient=ctx.createRadialGradient(r/2,r/2,r,r/2,r/2,0);
	gradient.addColorStop(0,color);
	gradient.addColorStop(1,"white");
	ctx.fillStyle=gradient;
	ctx.fill();
	ctx.strokeStyle='gray';
	ctx.stroke();
	ctx.rotate(angle);
	
	ctx.beginPath();
	ctx.arc(0,0,r,Math.PI/6,Math.PI*5/6);
	ctx.lineTo(r*Math.cos(Math.PI/6),r*Math.sin(Math.PI/6));
	ctx.moveTo(-r*Math.cos(Math.PI*5/6),-r*Math.sin(Math.PI/6));
	ctx.arc(0,0,r,-Math.PI*5/6,-Math.PI/6);
	ctx.lineTo(-r*Math.cos(Math.PI*5/6),-r*Math.sin(Math.PI/6));
	ctx.fillStyle='white';
	ctx.fill();
	ctx.stroke();
	
	ctx.restore();
	if(text!==undefined)
	{
		ctx.save();
		ctx.translate(x*this.scale+this.w/2,this.h/2-y*this.scale);
		ctx.beginPath();
		ctx.arc(0,0,r/3*this.scale,0,Math.PI*2);
		ctx.fillStyle="white";
		ctx.fill();
		ctx.rotate(-angle);
		ctx.textBaseline="middle";
		ctx.textAlign="center";
		ctx.font="bold 8px sans-serif";
		ctx.fillStyle="black";
		ctx.fillText(text,0,0);
		ctx.restore();
	}
};

Renderer.prototype.drawLine=function(line)
{
	if(line.points.length<1) return;
	this.ctx.beginPath();
	this.ctx.moveTo(line.points[0][0],line.points[0][1]);
	for(var i=0;i<line.points.length;i++)
	{
		this.ctx.lineTo(line.points[i][0],line.points[i][1]);
	}
	this.ctx.strokeStyle=line.color;
	this.ctx.stroke();
};

Renderer.prototype.view2Phy=function(p)
{
	var centerX=$(this.canvas).offset().left+$(this.canvas).width()/2,
		centerY=$(this.canvas).offset().top+$(this.canvas).height()/2;
	
	return [(p[0]-centerX)/this.scale*this.w/$(this.canvas).width(),-(p[1]-centerY)/this.scale*this.h/$(this.canvas).height()];
};
Renderer.prototype.phy2View=function(p)
{
	var centerX=$(this.canvas).offset().left+$(this.canvas).width()/2,
		centerY=$(this.canvas).offset().top+$(this.canvas).height()/2;
	return [p[0]*this.scale/this.w*$(this.canvas).width()+centerX,centerY-p[1]*this.scale/this.h*$(this.canvas).height()];
};