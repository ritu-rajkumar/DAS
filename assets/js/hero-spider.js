(function initHeroSpiderWeb() {
    'use strict';

    const canvas = document.getElementById('heroSpiderCanvas');
    const visual = document.getElementById('heroSpiderVisual');
    if (!canvas || !visual) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const TAU = Math.PI * 2;

    class Vec2 {
        constructor(x = 0, y = 0) {
            this.x = x;
            this.y = y;
        }

        clone() { return new Vec2(this.x, this.y); }
        add(vector) { return new Vec2(this.x + vector.x, this.y + vector.y); }
        sub(vector) { return new Vec2(this.x - vector.x, this.y - vector.y); }
        scale(coefficient) { return new Vec2(this.x * coefficient, this.y * coefficient); }
        mutableSet(vector) { this.x = vector.x; this.y = vector.y; return this; }
        mutableAdd(vector) { this.x += vector.x; this.y += vector.y; return this; }
        mutableSub(vector) { this.x -= vector.x; this.y -= vector.y; return this; }
        mutableScale(coefficient) { this.x *= coefficient; this.y *= coefficient; return this; }
        length() { return Math.hypot(this.x, this.y); }
        length2() { return (this.x * this.x) + (this.y * this.y); }
        dist2(vector) {
            const x = vector.x - this.x;
            const y = vector.y - this.y;
            return (x * x) + (y * y);
        }
        normal() {
            const magnitude = this.length();
            return magnitude > .00001 ? new Vec2(this.x / magnitude, this.y / magnitude) : new Vec2();
        }
        dot(vector) { return (this.x * vector.x) + (this.y * vector.y); }
        angle(vector) {
            return Math.atan2((this.x * vector.y) - (this.y * vector.x), (this.x * vector.x) + (this.y * vector.y));
        }
        angle2(left, right) { return left.sub(this).angle(right.sub(this)); }
        rotate(origin, theta) {
            const x = this.x - origin.x;
            const y = this.y - origin.y;
            return new Vec2(
                (x * Math.cos(theta)) - (y * Math.sin(theta)) + origin.x,
                (x * Math.sin(theta)) + (y * Math.cos(theta)) + origin.y
            );
        }
    }

    class Particle {
        constructor(position) {
            this.pos = position.clone();
            this.lastPos = position.clone();
        }
    }

    class DistanceConstraint {
        constructor(a, b, stiffness, targetDistance, segment = 0, attachment = false) {
            this.a = a;
            this.b = b;
            this.distance = typeof targetDistance === 'number' ? targetDistance : a.pos.sub(b.pos).length();
            this.stiffness = stiffness;
            this.segment = segment;
            this.attachment = attachment;
        }

        relax(stepCoefficient) {
            const normal = this.a.pos.sub(this.b.pos);
            const magnitude = normal.length2();
            if (magnitude < .000001) return;
            normal.mutableScale(((this.distance * this.distance) - magnitude) / magnitude * this.stiffness * stepCoefficient);
            this.a.pos.mutableAdd(normal);
            this.b.pos.mutableSub(normal);
        }
    }

    class PinConstraint {
        constructor(particle, position) {
            this.a = particle;
            this.pos = position.clone();
        }

        relax() {
            this.a.pos.mutableSet(this.pos);
        }
    }

    class AngleConstraint {
        constructor(a, b, c, stiffness) {
            this.a = a;
            this.b = b;
            this.c = c;
            this.angle = this.b.pos.angle2(this.a.pos, this.c.pos);
            this.stiffness = stiffness;
        }

        relax(stepCoefficient) {
            const angle = this.b.pos.angle2(this.a.pos, this.c.pos);
            let difference = angle - this.angle;
            if (difference <= -Math.PI) difference += TAU;
            else if (difference >= Math.PI) difference -= TAU;
            difference *= stepCoefficient * this.stiffness;
            this.a.pos = this.a.pos.rotate(this.b.pos, difference);
            this.c.pos = this.c.pos.rotate(this.b.pos, -difference);
            this.b.pos = this.b.pos.rotate(this.a.pos, difference);
            this.b.pos = this.b.pos.rotate(this.c.pos, -difference);
        }
    }

    class Composite {
        constructor() {
            this.particles = [];
            this.constraints = [];
        }

        pin(index) {
            const pin = new PinConstraint(this.particles[index], this.particles[index].pos);
            this.constraints.push(pin);
            return pin;
        }
    }

    class VerletEngine {
        constructor(width, height) {
            this.width = width;
            this.height = height;
            this.gravity = new Vec2(0, .19);
            this.friction = .99;
            this.groundFriction = .8;
            this.composites = [];
        }

        frame(iterations = 14) {
            this.composites.forEach(composite => {
                composite.particles.forEach(particle => {
                    const velocity = particle.pos.sub(particle.lastPos).scale(this.friction);
                    if (particle.pos.y >= this.height - 1 && velocity.length2() > .000001) {
                        velocity.mutableScale(this.groundFriction);
                    }
                    particle.lastPos.mutableSet(particle.pos);
                    particle.pos.mutableAdd(this.gravity);
                    particle.pos.mutableAdd(velocity);
                });
            });

            const stepCoefficient = 1 / iterations;
            this.composites.forEach(composite => {
                for (let pass = 0; pass < iterations; pass += 1) {
                    composite.constraints.forEach(constraint => constraint.relax(stepCoefficient));
                }
            });

            this.composites.forEach(composite => {
                composite.particles.forEach(particle => {
                    if (particle.pos.y > this.height - 1) particle.pos.y = this.height - 1;
                    if (particle.pos.x < 0) particle.pos.x = 0;
                    if (particle.pos.x > this.width - 1) particle.pos.x = this.width - 1;
                });
            });
        }
    }

    const state = {
        width: 1,
        height: 1,
        dpr: 1,
        engine: null,
        web: null,
        spider: null,
        startedAt: performance.now(),
        lastTime: performance.now(),
        frameNumber: 0,
        legIndex: 0,
        nextStepAt: 0,
        visible: true,
        pointer: new Vec2(-9999, -9999),
        pointerInside: false,
        pointerId: null,
        dragOffsets: null,
        draggedWebParticle: null,
        draggedPin: null,
        homing: null,
        intro: null,
        hangingHome: null,
        landingPoseOffsets: null,
        lookDirection: 0,
        spiderColorIndex: 0,
        resizeFrame: null
    };

    function createSpiderWeb(engine, origin, radius, segments = 20, depth = 7) {
        const stiffness = .6;
        const tension = .3;
        const stride = TAU / segments;
        const particleCount = segments * depth;
        const radiusStride = radius / particleCount;
        const composite = new Composite();

        for (let index = 0; index < particleCount; index += 1) {
            const theta = (index * stride) + (Math.cos(index * .4) * .05) + (Math.cos(index * .05) * .2);
            const shrinkingRadius = radius - (radiusStride * index) + (Math.cos(index * .1) * Math.min(20, radius * .09));
            const verticalOffset = Math.cos(theta * 2.1) * (radius / depth) * .2;
            composite.particles.push(new Particle(new Vec2(
                origin.x + (Math.cos(theta) * shrinkingRadius * 1.13),
                origin.y + (Math.sin(theta) * shrinkingRadius * .96) + verticalOffset
            )));
        }

        for (let index = 0; index < segments; index += 4) composite.pin(index);

        for (let index = 0; index < particleCount - 1; index += 1) {
            composite.constraints.push(new DistanceConstraint(composite.particles[index], composite.particles[index + 1], stiffness));
            const ringNeighbor = index + segments;
            composite.constraints.push(new DistanceConstraint(
                composite.particles[index],
                ringNeighbor < particleCount - 1 ? composite.particles[ringNeighbor] : composite.particles[particleCount - 1],
                stiffness
            ));
        }
        composite.constraints.push(new DistanceConstraint(composite.particles[0], composite.particles[segments - 1], stiffness));

        composite.constraints.forEach(constraint => {
            if (constraint instanceof DistanceConstraint) constraint.distance *= tension;
        });

        composite.silkConstraints = composite.constraints.filter(constraint => constraint instanceof DistanceConstraint);
        composite.pinConstraints = composite.constraints.filter(constraint => constraint instanceof PinConstraint);
        engine.composites.push(composite);
        return composite;
    }

    function createSpider(engine, origin) {
        const composite = new Composite();
        composite.legs = [];
        composite.structuralConstraints = [];
        composite.thorax = new Particle(origin);
        composite.head = new Particle(origin.add(new Vec2(0, -5)));
        composite.abdomen = new Particle(origin.add(new Vec2(0, 10)));
        composite.particles.push(composite.thorax, composite.head, composite.abdomen);

        const addStructuralDistance = (a, b, stiffness, segment) => {
            const constraint = new DistanceConstraint(a, b, stiffness, undefined, segment, false);
            composite.constraints.push(constraint);
            composite.structuralConstraints.push(constraint);
        };

        addStructuralDistance(composite.head, composite.thorax, 1, 0);
        addStructuralDistance(composite.abdomen, composite.thorax, 1, 0);
        composite.constraints.push(new AngleConstraint(composite.abdomen, composite.thorax, composite.head, .4));

        for (let legPair = 0; legPair < 4; legPair += 1) {
            const firstRight = new Particle(composite.thorax.pos.add(new Vec2(3, (legPair - 1.5) * 3)));
            const firstLeft = new Particle(composite.thorax.pos.add(new Vec2(-3, (legPair - 1.5) * 3)));
            composite.particles.push(firstRight, firstLeft);
            addStructuralDistance(firstRight, composite.thorax, .99, 1);
            addStructuralDistance(firstLeft, composite.thorax, .99, 1);

            let lengthCoefficient = 1;
            if (legPair === 1 || legPair === 2) lengthCoefficient = .7;
            else if (legPair === 3) lengthCoefficient = .9;

            const secondRight = new Particle(firstRight.pos.add(new Vec2(20, (legPair - 1.5) * 30).normal().scale(20 * lengthCoefficient)));
            const secondLeft = new Particle(firstLeft.pos.add(new Vec2(-20, (legPair - 1.5) * 30).normal().scale(20 * lengthCoefficient)));
            composite.particles.push(secondRight, secondLeft);
            addStructuralDistance(firstRight, secondRight, .99, 2);
            addStructuralDistance(firstLeft, secondLeft, .99, 2);

            const thirdRight = new Particle(secondRight.pos.add(new Vec2(20, (legPair - 1.5) * 50).normal().scale(20 * lengthCoefficient)));
            const thirdLeft = new Particle(secondLeft.pos.add(new Vec2(-20, (legPair - 1.5) * 50).normal().scale(20 * lengthCoefficient)));
            composite.particles.push(thirdRight, thirdLeft);
            addStructuralDistance(secondRight, thirdRight, .99, 3);
            addStructuralDistance(secondLeft, thirdLeft, .99, 3);

            const rightFoot = new Particle(thirdRight.pos.add(new Vec2(20, (legPair - 1.5) * 100).normal().scale(12 * lengthCoefficient)));
            const leftFoot = new Particle(thirdLeft.pos.add(new Vec2(-20, (legPair - 1.5) * 100).normal().scale(12 * lengthCoefficient)));
            composite.particles.push(rightFoot, leftFoot);
            composite.legs.push(rightFoot, leftFoot);
            addStructuralDistance(thirdRight, rightFoot, .99, 4);
            addStructuralDistance(thirdLeft, leftFoot, .99, 4);

            composite.constraints.push(new AngleConstraint(secondRight, thirdRight, rightFoot, .9));
            composite.constraints.push(new AngleConstraint(secondLeft, thirdLeft, leftFoot, .9));
            composite.constraints.push(new AngleConstraint(firstRight, secondRight, thirdRight, .4));
            composite.constraints.push(new AngleConstraint(firstLeft, secondLeft, thirdLeft, .4));
            composite.constraints.push(new AngleConstraint(composite.thorax, firstRight, secondRight, 1));
            composite.constraints.push(new AngleConstraint(composite.thorax, firstLeft, secondLeft, 1));
            composite.constraints.push(new AngleConstraint(composite.head, composite.thorax, firstRight, 1));
            composite.constraints.push(new AngleConstraint(composite.head, composite.thorax, firstLeft, 1));
        }

        engine.composites.push(composite);
        return composite;
    }

    function createHangingOffsets(spider) {
        const offsets = spider.particles.map(particle => particle.pos.sub(spider.thorax.pos).scale(-1));
        offsets[0] = new Vec2(0, 0);
        offsets[1] = new Vec2(0, 9);
        offsets[2] = new Vec2(0, -11);

        // Every pair arcs away from the body and returns to the centre silk.
        // The eight feet grip the rope at staggered heights, producing the
        // upside-down wrapped pose from the supplied reference.
        for (let pair = 0; pair < 4; pair += 1) {
            const base = 3 + (pair * 8);
            const gripY = -33 - (pair * 5.5);
            for (const side of [1, -1]) {
                const sideOffset = side === 1 ? 0 : 1;
                offsets[base + sideOffset] = new Vec2(side * (7 + pair), -3 + (pair * 1.2));
                offsets[base + 2 + sideOffset] = new Vec2(side * (18 + (pair * 2)), -10 - (pair * 2.4));
                offsets[base + 4 + sideOffset] = new Vec2(side * (12 + pair), -22 - (pair * 3.7));
                offsets[base + 6 + sideOffset] = new Vec2(side * (4 + ((pair % 2) * 2.2)), gripY);
            }
        }
        return offsets;
    }

    function detachFoot(spider, foot) {
        spider.constraints = spider.constraints.filter(constraint => !(constraint.attachment && constraint.a === foot));
    }

    function detachAllFeet(spider) {
        spider.constraints = spider.constraints.filter(constraint => !constraint.attachment);
    }

    function crawl(legIndex) {
        const { spider, web } = state;
        if (!spider || !web || state.dragOffsets || state.homing || state.intro) return;

        const foot = spider.legs[legIndex];
        const thorax = spider.thorax.pos;
        const forward = spider.head.pos.sub(thorax).normal();
        const side = new Vec2(-forward.y, forward.x);
        const sideFlag = legIndex % 2 === 0 ? 1 : -1;
        const frontFlag = legIndex < 4 ? 1 : -1;
        const occupied = new Set(
            spider.constraints
                .filter(constraint => constraint.attachment)
                .map(constraint => constraint.b)
        );

        const candidates = web.particles.filter(particle => {
            if (occupied.has(particle)) return false;
            const offset = particle.pos.sub(thorax);
            const squaredDistance = offset.length2();
            if (squaredDistance < (30 * 30) || squaredDistance > (108 * 108)) return false;
            return (offset.dot(side) * sideFlag) > -12 && (offset.dot(forward) * frontFlag) > -35;
        });

        detachFoot(spider, foot);
        if (!candidates.length) return;
        candidates.sort((a, b) => a.pos.dist2(foot.pos) - b.pos.dist2(foot.pos));
        const choicePool = candidates.slice(0, Math.min(5, candidates.length));
        const target = choicePool[Math.floor(Math.random() * choicePool.length)];
        spider.constraints.push(new DistanceConstraint(foot, target, 1, 0, 5, true));
    }

    function nearestWebParticle(point) {
        let nearest = null;
        let nearestDistance = Infinity;
        state.web.particles.forEach(particle => {
            const candidateDistance = particle.pos.dist2(point);
            if (candidateDistance < nearestDistance) {
                nearestDistance = candidateDistance;
                nearest = particle;
            }
        });
        return nearest;
    }

    function beginHoming(preferredTarget = null) {
        if (!state.spider || !state.web) return;
        const target = preferredTarget || nearestWebParticle(state.spider.thorax.pos);
        if (!target) return;
        const origin = state.spider.thorax.pos.clone();
        const travelDistance = Math.sqrt(origin.dist2(target.pos));
        state.homing = {
            target,
            origin,
            startedAt: performance.now(),
            duration: Math.max(380, Math.min(1150, travelDistance * 3.1)),
            offsets: state.spider.particles.map(particle => particle.pos.sub(origin)),
            targetOffsets: state.landingPoseOffsets
        };
    }

    function setSpiderPose(thoraxPosition, offsets) {
        state.spider.particles.forEach((particle, index) => {
            const nextPosition = thoraxPosition.add(offsets[index]);
            particle.pos.mutableSet(nextPosition);
            particle.lastPos.mutableSet(nextPosition);
        });
    }

    function blendPoseOffsets(fromOffsets, toOffsets, progress) {
        return fromOffsets.map((offset, index) =>
            offset.scale(1 - progress).add(toOffsets[index].scale(progress))
        );
    }

    function silkSway(now) {
        return (Math.sin(now * .00165) * 10) + (Math.sin(now * .00073) * 4);
    }

    function finishHoming() {
        state.homing = null;
        attachSpiderSecurely();
    }

    function attachSpiderSecurely() {
        const spider = state.spider;
        const web = state.web;
        if (!spider || !web) return;
        detachAllFeet(spider);

        // Four alternating feet create a stable stance immediately. The normal
        // crawl cycle then moves all eight feet independently across the web.
        const usedTargets = new Set();
        [0, 3, 4, 7].forEach(legIndex => {
            const foot = spider.legs[legIndex];
            const candidates = web.particles
                .filter(particle => !usedTargets.has(particle))
                .sort((a, b) => a.pos.dist2(foot.pos) - b.pos.dist2(foot.pos));
            const target = candidates[0];
            if (!target) return;
            usedTargets.add(target);
            spider.constraints.push(new DistanceConstraint(foot, target, .86, 0, 5, true));
        });
    }

    function applyHoming(now) {
        if (!state.homing) return;
        const progress = Math.min(1, (now - state.homing.startedAt) / state.homing.duration);
        const eased = progress < .5
            ? 4 * progress * progress * progress
            : 1 - (Math.pow(-2 * progress + 2, 3) / 2);
        const destination = state.homing.target.pos;
        const thoraxPosition = new Vec2(
            state.homing.origin.x + ((destination.x - state.homing.origin.x) * eased),
            state.homing.origin.y + ((destination.y - state.homing.origin.y) * eased)
        );

        const poseOffsets = state.homing.targetOffsets
            ? blendPoseOffsets(state.homing.offsets, state.homing.targetOffsets, eased)
            : state.homing.offsets;
        setSpiderPose(thoraxPosition, poseOffsets);
        if (progress >= 1) finishHoming();
    }

    function applyIntro(now) {
        const intro = state.intro;
        if (!intro || !state.spider) return;

        const elapsed = now - intro.startedAt;
        if (elapsed >= 2880) visual.classList.add('has-released-spider');
        const landingPoint = intro.landingNode?.pos || intro.hang;
        const approachDepth = Math.min(72, state.height * .18);
        const liveSway = silkSway(now) * .82;
        const approach = new Vec2(
            landingPoint.x + liveSway,
            landingPoint.y - approachDepth
        );
        let thoraxPosition = approach.clone();
        let poseOffsets = intro.offsets;
        let phase = 'pause';
        state.lookDirection = 0;

        if (elapsed < 1380) {
            phase = 'descend';
            const progress = Math.max(0, Math.min(1, elapsed / 1380));
            const eased = 1 - Math.pow(1 - progress, 3);
            thoraxPosition = new Vec2(
                intro.start.x + ((approach.x - intro.start.x) * eased),
                intro.start.y + ((approach.y - intro.start.y) * eased)
            );
        } else if (elapsed < 1760) {
            phase = 'pause';
            thoraxPosition = approach.clone();
            thoraxPosition.y += Math.sin((elapsed - 1380) * .012) * 1.2;
        } else if (elapsed < 2180) {
            phase = 'look';
            state.lookDirection = 1;
            thoraxPosition = approach.clone();
        } else if (elapsed < 2600) {
            phase = 'look';
            state.lookDirection = -1;
            thoraxPosition = approach.clone();
        } else if (elapsed < 2880) {
            phase = 'crouch';
            const progress = (elapsed - 2600) / 280;
            thoraxPosition = approach.add(new Vec2(0, 12 * progress));
        } else if (elapsed < 3780) {
            phase = 'jump';
            const progress = (elapsed - 2880) / 900;
            const eased = progress * (2 - progress);
            const releaseSway = silkSway(intro.startedAt + 2880) * .82;
            const releasePoint = new Vec2(
                intro.hang.x + releaseSway,
                intro.hang.y - approachDepth + 12
            );
            thoraxPosition = new Vec2(
                releasePoint.x + ((landingPoint.x - releasePoint.x) * eased),
                releasePoint.y + ((landingPoint.y - releasePoint.y) * eased)
                    - (Math.sin(progress * Math.PI) * 96)
            );
            poseOffsets = blendPoseOffsets(intro.offsets, intro.landingOffsets, eased);
        } else if (elapsed < 4200) {
            phase = 'land';
            const progress = (elapsed - 3780) / 420;
            const settle = 1 - progress;
            thoraxPosition = new Vec2(
                landingPoint.x,
                landingPoint.y + (Math.sin(progress * Math.PI * 2.5) * 10 * settle)
            );
            poseOffsets = intro.landingOffsets;
        } else {
            setSpiderPose(landingPoint, intro.landingOffsets);
            state.intro = null;
            state.nextStepAt = now + 360;
            attachSpiderSecurely();
            return;
        }

        intro.phase = phase;
        setSpiderPose(thoraxPosition, poseOffsets);
    }

    function applyDrag() {
        if (state.dragOffsets) {
            state.spider.particles.forEach((particle, index) => {
                const position = state.pointer.add(state.dragOffsets[index]);
                particle.pos.mutableSet(position);
                particle.lastPos.mutableSet(position);
            });
        } else if (state.draggedPin) {
            state.draggedPin.pos.mutableSet(state.pointer);
            state.draggedPin.a.pos.mutableSet(state.pointer);
            state.draggedPin.a.lastPos.mutableSet(state.pointer);
        } else if (state.draggedWebParticle) {
            state.draggedWebParticle.pos.mutableSet(state.pointer);
            state.draggedWebParticle.lastPos.mutableSet(state.pointer);
        }
    }

    const clickColorPalettes = [
        ['#27225f', '#302a70', '#211d53', '#181540', '#11102e'],
        ['#ff5528', '#ed4a22', '#cf3f1d', '#a93319', '#792515'],
        ['#18865f', '#167652', '#126347', '#0e4e39', '#0b392b'],
        ['#245fad', '#20549b', '#1b4783', '#153968', '#102b50'],
        ['#8d318f', '#7c2a80', '#68236c', '#511b55', '#3b143f']
    ];

    function spiderColors() {
        return clickColorPalettes[state.spiderColorIndex % clickColorPalettes.length];
    }

    function drawWeb(now) {
        const web = state.web;
        if (!web) return;
        const revealProgress = prefersReducedMotion ? 1 : Math.min(1, Math.max(0, (now - state.startedAt - 180) / 3800));
        const visibleConstraintCount = Math.floor(web.silkConstraints.length * revealProgress);
        const visibleParticleCount = Math.floor(web.particles.length * revealProgress);

        ctx.save();
        ctx.lineCap = 'round';
        // Keep the complete web faintly visible from frame one, then strengthen
        // each strand during the build animation. This also provides a useful
        // static fallback if animation frames are throttled by the browser.
        for (let index = 0; index < web.silkConstraints.length; index += 1) {
            const constraint = web.silkConstraints[index];
            const hasBeenWoven = index < visibleConstraintCount;
            ctx.beginPath();
            ctx.moveTo(constraint.a.pos.x, constraint.a.pos.y);
            ctx.lineTo(constraint.b.pos.x, constraint.b.pos.y);
            ctx.strokeStyle = hasBeenWoven
                ? 'rgba(86, 132, 143, .58)'
                : 'rgba(104, 143, 152, .22)';
            ctx.lineWidth = hasBeenWoven ? 1.15 : .72;
            ctx.stroke();
        }

        for (let index = 0; index < web.particles.length; index += 1) {
            const particle = web.particles[index];
            const hasBeenWoven = index < visibleParticleCount;
            ctx.beginPath();
            ctx.arc(particle.pos.x, particle.pos.y, hasBeenWoven ? 1.28 : .85, 0, TAU);
            ctx.fillStyle = hasBeenWoven
                ? 'rgba(42, 126, 132, .74)'
                : 'rgba(69, 134, 139, .28)';
            ctx.fill();
        }

        web.pinConstraints.forEach(pin => {
            ctx.beginPath();
            ctx.arc(pin.pos.x, pin.pos.y, 5.2, 0, TAU);
            ctx.fillStyle = 'rgba(101, 198, 236, .3)';
            ctx.fill();
        });

        if (state.spider && state.spider.legs.length >= 8) {
            const feet = state.spider.legs.map(leg => leg.pos);
            const holdingRope = Boolean(state.intro
                && !['jump', 'land'].includes(state.intro.phase));

            if (holdingRope) {
                const ropeFlex = silkSway(now);
                const gripX = feet.reduce((total, foot) => total + foot.x, 0) / feet.length;
                const ropeEndY = Math.max(...feet.map(foot => foot.y)) + 3;

                // The complete upper silk exists only until the spider jumps.
                ctx.beginPath();
                ctx.moveTo(state.width * .5, -3);
                ctx.bezierCurveTo(
                    (state.width * .5) + (ropeFlex * .35), ropeEndY * .27,
                    gripX - ropeFlex, ropeEndY * .68,
                    gripX, ropeEndY
                );
                ctx.strokeStyle = 'rgba(65, 108, 118, .74)';
                ctx.lineWidth = 2.7;
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(state.width * .5, -3);
                ctx.bezierCurveTo(
                    (state.width * .5) - (ropeFlex * .18), ropeEndY * .3,
                    gripX - (ropeFlex * .72), ropeEndY * .7,
                    gripX, ropeEndY
                );
                ctx.strokeStyle = 'rgba(192, 222, 226, .66)';
                ctx.lineWidth = .65;
                ctx.stroke();

                // While hanging, every foot shares the silk endpoint and thus
                // inherits exactly the same sway as the flexible rope.
                feet.forEach(foot => {
                    ctx.beginPath();
                    ctx.moveTo(gripX, foot.y);
                    ctx.quadraticCurveTo((gripX + foot.x) / 2, foot.y - 2, foot.x, foot.y);
                    ctx.strokeStyle = 'rgba(65, 108, 118, .76)';
                    ctx.lineWidth = 1.45;
                    ctx.stroke();
                });
            }
        }
        ctx.restore();
    }

    function drawSpider(now) {
        const spider = state.spider;
        if (!spider) return;
        const colors = spiderColors();

        ctx.save();
        ctx.lineCap = 'round';
        spider.structuralConstraints.forEach(constraint => {
            const segment = Math.max(1, constraint.segment);
            ctx.beginPath();
            ctx.moveTo(constraint.a.pos.x, constraint.a.pos.y);
            ctx.lineTo(constraint.b.pos.x, constraint.b.pos.y);
            ctx.strokeStyle = colors[Math.min(4, segment)];
            ctx.lineWidth = Math.max(.85, 3.2 - (segment * .55));
            ctx.stroke();
        });

        const drawBodyCircle = (particle, radius, color) => {
            ctx.beginPath();
            ctx.arc(particle.pos.x, particle.pos.y, radius, 0, TAU);
            ctx.fillStyle = color;
            ctx.fill();
        };
        drawBodyCircle(spider.head, 7, colors[0]);
        drawBodyCircle(spider.thorax, 4.5, colors[1]);
        drawBodyCircle(spider.abdomen, 8.5, colors[0]);

        const bodyAngle = Math.atan2(
            spider.head.pos.y - spider.thorax.pos.y,
            spider.head.pos.x - spider.thorax.pos.x
        ) + (Math.PI / 2);
        ctx.translate(spider.head.pos.x, spider.head.pos.y);
        ctx.rotate(bodyAngle);

        const pointerX = state.pointer.x - spider.head.pos.x;
        const pointerY = state.pointer.y - spider.head.pos.y;
        const localX = (pointerX * Math.cos(bodyAngle)) + (pointerY * Math.sin(bodyAngle));
        const localY = (-pointerX * Math.sin(bodyAngle)) + (pointerY * Math.cos(bodyAngle));
        const pointerLength = Math.max(1, Math.hypot(localX, localY));
        let pupilX = state.pointerInside ? (localX / pointerLength) * .7 : 0;
        let pupilY = state.pointerInside ? (localY / pointerLength) * .7 : -.4;
        if (state.intro?.phase === 'look') {
            pupilX = state.lookDirection * .92;
            pupilY = -.05;
        }

        [-2.55, 2.55].forEach(eyeX => {
            ctx.beginPath();
            ctx.arc(eyeX, -1.65, 1.9, 0, TAU);
            ctx.fillStyle = '#ffffff';
            ctx.fill();
            ctx.beginPath();
            ctx.arc(eyeX + pupilX, -1.65 + pupilY, .78, 0, TAU);
            ctx.fillStyle = '#0b0c10';
            ctx.fill();
        });
        ctx.restore();
    }

    function draw(now) {
        ctx.clearRect(0, 0, state.width, state.height);
        drawWeb(now);
        drawSpider(now);
    }

    function buildScene() {
        state.engine = new VerletEngine(state.width, state.height);
        const origin = new Vec2(state.width * .5, state.height * .44);
        const radius = Math.max(80, Math.min(state.width * .46, state.height * .48));
        state.web = createSpiderWeb(state.engine, origin, radius, 20, 7);

        // Let the silk find its tension before the first paint. The supplied
        // Verlet demo does this on-screen; pre-settling gives the first visible
        // frame the same organic, asymmetric star shape instead of a flat circle.
        if (!prefersReducedMotion) {
            for (let settleFrame = 0; settleFrame < 105; settleFrame += 1) {
                state.engine.frame(14);
            }
        }

        const introStart = new Vec2(state.width * .5, -34);
        state.spider = createSpider(state.engine, prefersReducedMotion ? origin : introStart);
        state.startedAt = performance.now();
        state.lastTime = state.startedAt;
        state.frameNumber = 0;
        state.legIndex = 0;
        state.nextStepAt = state.startedAt + 550;
        state.dragOffsets = null;
        state.draggedWebParticle = null;
        state.draggedPin = null;
        state.homing = null;
        state.intro = null;
        state.hangingHome = null;
        state.landingPoseOffsets = null;
        state.lookDirection = 0;
        visual.classList.remove('has-released-spider');
        canvas.classList.remove('is-dragging');

        const landingOffsets = state.spider.particles.map(particle =>
            particle.pos.sub(state.spider.thorax.pos)
        );
        const hangingOffsets = createHangingOffsets(state.spider);
        const landingNode = nearestWebParticle(origin);
        state.landingPoseOffsets = landingOffsets;
        state.hangingHome = {
            hang: landingNode ? landingNode.pos.clone() : new Vec2(origin.x, origin.y),
            offsets: hangingOffsets
        };

        if (prefersReducedMotion) {
            visual.classList.add('has-released-spider');
            setSpiderPose(landingNode?.pos || origin, landingOffsets);
            attachSpiderSecurely();
        } else {
            setSpiderPose(introStart, hangingOffsets);
            state.intro = {
                phase: 'descend',
                startedAt: state.startedAt,
                start: introStart,
                hang: state.hangingHome.hang.clone(),
                offsets: hangingOffsets,
                landingOffsets,
                landingNode
            };
        }
    }

    function resizeCanvas() {
        const bounds = visual.getBoundingClientRect();
        const width = Math.max(1, Math.round(bounds.width));
        const height = Math.max(1, Math.round(bounds.height));
        if (width === state.width && height === state.height && state.engine) return;
        state.width = width;
        state.height = height;
        state.dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.round(width * state.dpr);
        canvas.height = Math.round(height * state.dpr);
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
        buildScene();
        draw(performance.now());
    }

    function animate(now) {
        const delta = Math.min(34, Math.max(0, now - state.lastTime));
        state.lastTime = now;
        // Always advance while the page is open. Some browsers report an
        // absolutely-positioned transparent canvas as non-intersecting during
        // initial layout, which previously left only the anchor dots visible.
        if (state.engine) {
            if (!prefersReducedMotion) {
                state.engine.frame(14);
                applyDrag();
                if (!state.dragOffsets) applyIntro(now);
                applyHoming(now);
                if (!state.dragOffsets && !state.homing && !state.intro && now >= state.nextStepAt) {
                    crawl((state.legIndex * 3) % 8);
                    state.legIndex += 1;
                    state.nextStepAt = now + 82 + (Math.random() * 58);
                }
                state.frameNumber += Math.max(1, Math.round(delta / 16.667));
            }
            draw(now);
        }
        window.requestAnimationFrame(animate);
    }

    function canvasPoint(event) {
        const bounds = canvas.getBoundingClientRect();
        return new Vec2(
            Math.max(0, Math.min(bounds.width, event.clientX - bounds.left)),
            Math.max(0, Math.min(bounds.height, event.clientY - bounds.top))
        );
    }

    function pointToSegmentDistance2(point, start, end) {
        const segmentX = end.x - start.x;
        const segmentY = end.y - start.y;
        const segmentLength2 = (segmentX * segmentX) + (segmentY * segmentY);
        if (segmentLength2 < .0001) return point.dist2(start);
        const projection = Math.max(0, Math.min(1,
            (((point.x - start.x) * segmentX) + ((point.y - start.y) * segmentY)) / segmentLength2
        ));
        const closest = new Vec2(start.x + (segmentX * projection), start.y + (segmentY * projection));
        return point.dist2(closest);
    }

    function webEntityNear(point, hitRadius = 38) {
        if (!state.web) return null;
        let nearestParticle = null;
        let nearestDistance = hitRadius * hitRadius;

        // Nodes are the primary targets, including the five outer pinned
        // anchors just like the original Verlet demo.
        state.web.particles.forEach(particle => {
            const candidate = particle.pos.dist2(point);
            if (candidate < nearestDistance) {
                nearestDistance = candidate;
                nearestParticle = particle;
            }
        });

        // A strand itself is draggable too. Pick its nearest endpoint so users
        // do not need pixel-perfect aim on the tiny teal nodes.
        state.web.silkConstraints.forEach(constraint => {
            const candidate = pointToSegmentDistance2(point, constraint.a.pos, constraint.b.pos);
            if (candidate >= nearestDistance) return;
            nearestDistance = candidate;
            nearestParticle = constraint.a.pos.dist2(point) < constraint.b.pos.dist2(point)
                ? constraint.a
                : constraint.b;
        });

        if (!nearestParticle) return null;
        const pin = state.web.pinConstraints.find(constraint => constraint.a === nearestParticle) || null;
        return { particle: nearestParticle, pin };
    }

    function pointerDown(event) {
        if (!state.spider || !state.web) return;
        const point = canvasPoint(event);
        state.pointer.mutableSet(point);
        state.pointerInside = true;
        state.pointerId = event.pointerId;

        if (point.dist2(state.spider.thorax.pos) <= (38 * 38)) {
            event.preventDefault();
            visual.classList.add('has-released-spider');
            state.spiderColorIndex = (state.spiderColorIndex + 1) % clickColorPalettes.length;
            detachAllFeet(state.spider);
            state.homing = null;
            state.intro = null;
            state.lookDirection = 0;
            state.draggedPin = null;
            state.dragOffsets = state.spider.particles.map(particle => particle.pos.sub(point));
            canvas.classList.add('is-dragging');
            canvas.setPointerCapture?.(event.pointerId);
            return;
        }

        const entity = webEntityNear(point, 42);
        if (entity) {
            event.preventDefault();
            if (entity.pin) state.draggedPin = entity.pin;
            else state.draggedWebParticle = entity.particle;
            canvas.classList.add('is-dragging');
            canvas.setPointerCapture?.(event.pointerId);
        }
    }

    function pointerMove(event) {
        const point = canvasPoint(event);
        state.pointer.mutableSet(point);
        state.pointerInside = true;
        if (state.pointerId === event.pointerId && (state.dragOffsets || state.draggedWebParticle || state.draggedPin)) {
            event.preventDefault();
            applyDrag();
        }
    }

    function pointerUp(event) {
        if (state.pointerId !== event.pointerId) return;
        const wasDraggingSpider = Boolean(state.dragOffsets);
        state.dragOffsets = null;
        state.draggedWebParticle = null;
        state.draggedPin = null;
        state.pointerId = null;
        canvas.classList.remove('is-dragging');
        if (canvas.hasPointerCapture?.(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
        if (wasDraggingSpider) beginHoming();
    }

    canvas.addEventListener('pointerdown', pointerDown);
    canvas.addEventListener('pointermove', pointerMove);
    canvas.addEventListener('pointerup', pointerUp);
    canvas.addEventListener('pointercancel', pointerUp);
    canvas.addEventListener('pointerenter', event => {
        const point = canvasPoint(event);
        state.pointer.mutableSet(point);
        state.pointerInside = true;
    });
    canvas.addEventListener('pointerleave', () => {
        if (!state.dragOffsets && !state.draggedWebParticle && !state.draggedPin) {
            state.pointerInside = false;
        }
    });

    canvas.addEventListener('keydown', event => {
        if (!state.spider) return;
        const movements = {
            ArrowLeft: new Vec2(-12, 0),
            ArrowRight: new Vec2(12, 0),
            ArrowUp: new Vec2(0, -12),
            ArrowDown: new Vec2(0, 12)
        };
        if (movements[event.key]) {
            event.preventDefault();
            detachAllFeet(state.spider);
            state.homing = null;
            state.intro = null;
            state.lookDirection = 0;
            const movement = movements[event.key];
            state.spider.particles.forEach(particle => {
                particle.pos.mutableAdd(movement);
                particle.lastPos.mutableAdd(movement);
            });
        } else if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            beginHoming();
        } else if (event.key.toLowerCase() === 'r') {
            event.preventDefault();
            buildScene();
        }
    });

    if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver(entries => {
            state.visible = Boolean(entries[0]?.isIntersecting);
            state.lastTime = performance.now();
        }, { rootMargin: '100px 0px', threshold: 0 });
        observer.observe(visual);
    }

    const queueResize = () => {
        if (state.resizeFrame !== null) window.cancelAnimationFrame(state.resizeFrame);
        state.resizeFrame = window.requestAnimationFrame(() => {
            state.resizeFrame = null;
            resizeCanvas();
        });
    };
    if ('ResizeObserver' in window) new ResizeObserver(queueResize).observe(visual);
    else window.addEventListener('resize', queueResize, { passive: true });

    resizeCanvas();
    window.requestAnimationFrame(animate);
})();
