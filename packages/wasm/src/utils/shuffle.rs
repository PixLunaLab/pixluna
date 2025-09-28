use js_sys::Math;

pub fn shuffle_indices(len: u32) -> Vec<u32> {
    let mut v: Vec<u32> = (0..len).collect();
    if len <= 1 {
        return v;
    }
    let mut i = len - 1;
    while i > 0 {
        // j in [0, i]
        let j = (Math::random() * ((i + 1) as f64)).floor() as u32;
        v.swap(i as usize, j as usize);
        i -= 1;
    }
    v
}
