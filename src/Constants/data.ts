export interface TargetData {
  targetIndex: number;
  video: string;
  model: string;
  thumbnail: string;
}

export interface DummyData {
  mindFile: string;
  targets: TargetData[];
}

const dummyData: DummyData = {
  mindFile: "/targets1.mind",
  targets: [
    {
      targetIndex: 0,
      video:
        "https://res.cloudinary.com/mandip/video/upload/v1784786061/ar-targets/videos/se7y5fgit4lh2qgi7xpm.mp4",
      model: "/goal.glb",
      thumbnail:
        "https://res.cloudinary.com/mandip/image/upload/v1784786060/ar-targets/images/latcopfityphaunefust.png",
    },
    {
      targetIndex: 1,
      video:
        "https://res.cloudinary.com/mandip/video/upload/v1784792145/demo_video2_wgo2mw.mp4",
      model: "",
      thumbnail:
        "https://res.cloudinary.com/mandip/image/upload/v1784792118/model2_fu3oea.jpg",
    },
  ],
};

export default dummyData;
