$(document).ready(function() {
	var mouseDown = false;
	var draggingItem = null;
	var lastMouseY = 0;
	var lastMouseX = 0;

	var realtimeArrange = true;

	var dragItems = [];
	var dragTargets = [];
	initList();

	$(".draggable").on("mousedown", function(e) {
		mouseDown = true;
		draggingItem = $.grep(dragItems, function(item){ return item.dragging; })[0];
	});

	$(document).on("mouseup", function() {
		if(draggingItem !== null) {
			var arrangeNeeded = draggingItem.snapTarget !== null && !draggingItem.snapTarget.isEmpty();
			draggingItem.snap();
			if(arrangeNeeded) {
				arrangeList();
			}
			reset();
		}
	});

	$(document).on("mousemove", function(e) {
		if(!mouseDown){ return; }

		if(mouseDown && draggingItem !== null) {
			var directionY = e.pageY < lastMouseY ? "up" : "down";
			var directionX = e.pageX < lastMouseX ? "right" : "left";
			var height = draggingItem.elem.outerHeight();
            var width = draggingItem.elem.outerWidth();
            var left = e.clientX - draggingItem.anchorPoint.left;
            var top = e.clientY - draggingItem.anchorPoint.top;

            // Restrict dragging to a pre-defined area.
            // All the items must be inside a drag_area container for this to work.
            var area = $(".drag_area");
            if(area.length !== 0 && area !== null){
            	var areaBounds = area[0].getBoundingClientRect();
	            if ((left + width) >= areaBounds.right) {
	                left = areaBounds.right - width;
	            }
	            if (left <= areaBounds.left) {
	                left = areaBounds.left;
	            }
	            if(top <= areaBounds.top) {
	            	top = areaBounds.top;
	            }
	            if((top + height) >= areaBounds.bottom) {
	            	top = areaBounds.bottom - height;
	            }

            }

            if(draggingItem.elem.hasClass("sticky") && draggingItem.dragStartPos !== null){
            	var distance = draggingItem.calculateDistance(e.pageX, e.pageY);
            	if(distance >= 70) {
            		draggingItem.dragStartPos = null;
            		draggingItem.move(top, left);
            	}
            } else {
            	draggingItem.move(top, left)
            }

            // Find closest snap position.
            var overlapHandled = false;
            draggingItem.snapTarget = null;
            $(dragItems).each(function() {
            	var item = this.dragTarget.elem;
            	var rect1 = draggingItem.elem[0].getBoundingClientRect();
				var rect2 = item[0].getBoundingClientRect();

				var overlap = !(rect1.right < rect2.left || 
	                rect1.left > rect2.right || 
	                (rect1.bottom - rect1.height / 2) < rect2.top || 
	                (rect1.top + rect1.height / 2) > rect2.bottom);

				if (overlap && !overlapHandled) {
					overlapHandled = true;
					$(item).css("opacity", 1);
					draggingItem.setSnapTarget(this.dragTarget);

					if(realtimeArrange){
						var arrangeNeeded = draggingItem.snapTarget !== null && !draggingItem.snapTarget.isEmpty();
						draggingItem.simulateSnap();
						if(arrangeNeeded) {
							arrangeList();
						}
					}
				} else{
					$(item).css("opacity", 0.2);
				}
            });


            lastMouseY = e.pageY;
            lastMouseX = e.pageX;
		}
	});

	function arrangeList() {
		var moved = false;
		var arrangeDirection = null;
		var startingIndex = 0;
		var emptyIndex = 0;

		$(dragItems).each(function() {
			if($(this).is($(draggingItem))) { return; }

			if(draggingItem.dragTarget.index === this.dragTarget.index) {

				arrangeDirection = this.dragTarget.index < draggingItem.index ? "down" : "up";
				startingIndex = this.dragTarget.index;
				emptyIndex = draggingItem.index;
			}
		});

		$(dragItems).each(function(i) {
			if(!$(this).is($(draggingItem))) {
				var t = this;
				var newIndex = $.extend({}, { index: t.index }).index;
				var indexChanged = false;
				if(arrangeDirection === "up") {
					if(this.index <= startingIndex && this.index > emptyIndex && this.index - 1 >= 0) {
						newIndex--;
						indexChanged = true;
					}
				} else {
					if(this.index >= startingIndex && this.index < emptyIndex && this.index + 1 < dragItems.length) {
						newIndex++;
						indexChanged = true;
					}
				}
				if(indexChanged) {
					var target = $.grep(dragTargets, function(dt) { return dt.index === newIndex; })[0];
					if(target !== undefined){
						this.snapTarget = target;
						this.snap();
					}
				}
			}
			this.index = this.dragTarget.index;
		});
	}

	function initList() {
		var area = $(".drag_area");
		var items = area.find(".draggable");
		if(items.length !== 0) {
			var itemHeight = $(items[0]).outerHeight();
			var itemWidth = $(items[0]).outerWidth();
			var areaBounds = area[0].getBoundingClientRect();
			var parts = areaBounds.height / items.length;
			$.each(items, function(i) {
				var pos = $(this).offset();
				var dragTarget = new DragTarget($("<div class='drag_target'></div>"), i);
				dragTarget.elem.css({"height": itemHeight, "width": itemWidth, "top": pos.top, "left": pos.left}); 
				area.prepend(dragTarget.elem);

				var item = new DragItem($(this), dragTarget, i);
				dragItems.push(item);
				dragTargets.push(dragTarget);
			});
		}
	}

	function reset() {
		mouseDown = false;
		draggingItem.reset();
		draggingItem = null;
		$(".drag_target").each(function() {
			$(this).css("opacity", 0);
		});
	}

});


function DragItem(elem, dragTarget, index) {
	this.elem = elem;
	this.dragTarget = dragTarget;
	this.index = index;
	this.startingPos = null;
	this.anchorPoint = null;
	this.dragStartPos = null;
	this.snapTarget = null;
	this.dragging = false;

	var t = this;
	this.elem.on("mousedown", function(e) {
		if(t.elem.hasClass("snapping")){ return; }

		var offset = $(this).offset();
		t.startingPos = offset;
		t.anchorPoint = { top: e.pageY - offset.top, left: e.pageX - offset.left };
		t.dragStartPos = { top: e.pageY, left: e.pageX };
		t.dragging = true;
		t.dragTarget.empty = true;
	});

	DragItem.prototype.move = function(top, left) {
		this.elem.offset({ top: top, left: left });
	};

	DragItem.prototype.snap = function() {
		this.elem.addClass("snapping");

		if(this.snapTarget !== null) { 
			this.move(this.snapTarget.elem.offset().top, this.snapTarget.elem.offset().left);
			this.dragTarget = this.snapTarget;
			this.dragTarget.empty = false;
		} else {
			this.move(this.startingPos.top, this.startingPos.left);
		}

		var t = this;
		setTimeout(function(){
			t.elem.removeClass("snapping");
		}, 300);
	};

	// Used for realtime arranging, sets a new dragtarget without actually moving to it.
	DragItem.prototype.simulateSnap = function() {
		if(this.snapTarget !== null) { 
			this.dragTarget = this.snapTarget;
			this.dragTarget.empty = false;
		}
	};

	DragItem.prototype.reset = function() {
		this.startingPos = null;
		this.anchorPoint = null;
		this.dragStartPos = null;
		this.dragging = false;
	};

	DragItem.prototype.calculateDistance = function(mouseX, mouseY) {
        return Math.floor(Math.sqrt(Math.pow(mouseX - this.dragStartPos.left, 2) + 
        	Math.pow(mouseY - this.dragStartPos.top, 2)));
	};

	DragItem.prototype.setDragging = function(dragging) {
		this.dragging = dragging;
	};

	DragItem.prototype.setSnapTarget = function(target) {
		this.snapTarget = target;
	};

	DragItem.prototype.setStartingPos = function(pos) {
		this.startingPos = pos;
	};
}

function DragTarget(elem, index) {
	this.elem = elem;
	this.index = index;
	this.empty = false;

	DragTarget.prototype.isEmpty = function() {
		return this.empty;
	};
}