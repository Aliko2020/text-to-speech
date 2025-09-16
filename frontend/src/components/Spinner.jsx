import ClipLoader from "react-spinners/ClipLoader";

const Loader = () => {
    return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
            <ClipLoader size={50} color="#4f46e5" />
        </div>
    );
};

export default Loader;
