#!/bin/bash
cd "$(dirname "$0")/../.."
A=./tools/concept/anchor.sh
run4() { while [ "$(jobs -rp | wc -l)" -ge 4 ]; do wait -n; done; "$@" & }

run4 $A unfold "He spreads BOTH ARMS wide and open, palms up at chest height, as if unfolding something invisible between them. The talismans swirl outward into a wide ring around him. Expression: calm authority, lips slightly parted as if he has just spoken. Chin level."
run4 $A point "He points his INDEX FINGER directly at the viewer, arm extended toward the camera, hand slightly foreshortened. Expression: sharp and certain, one eyebrow raised, a small knowing smirk. Chin slightly down, eyes up at the viewer."
run4 $A greet "He stands with ARMS FOLDED across his chest, weight on one leg, relaxed. Expression: only one corner of his mouth lifted, cool and unimpressed but not unkind. Head slightly tilted back."
run4 $A laugh "He is LAUGHING genuinely — head tipped back a little, eyes crinkled almost shut, teeth showing, one hand loosely raised near his chest. Warm and disarming. The talismans scatter brightly around him."
run4 $A grave "He looks down at the viewer with eyes half-lowered and jaw set, one hand closed into a loose fist at his side. Expression: serious, unsparing, no smile. The talismans hang almost still and dim."
run4 $A far "He has turned his FACE toward the camera while his body angles away, gazing past the viewer into the far distance, eyes distant and unfocused. Wind lifts his hair and sleeves. Expression: quiet, a little melancholy."
run4 $A amused "He holds a SINGLE talisman pinched between two fingers, raised beside his cheek, and studies the viewer over it. Expression: eyes narrowed with amusement, one side of the mouth curled. Playful, teasing."
run4 $A close "He extends ONE OPEN HAND toward the viewer, palm up, offering. Expression: faint warm smile, eyes soft and direct. The talismans drift down slowly and fade."
wait
echo "=== 앵커 $(ls assets/scene/*.png 2>/dev/null | wc -l)/8 ==="
